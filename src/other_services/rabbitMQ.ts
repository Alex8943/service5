import amqp from "amqplib";

const RABBITMQ_URL = "amqp://localhost"; // Update if RabbitMQ is hosted remotely

export async function createChannel() {
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();
    return { connection, channel };
}

export async function setupQueues() {
    const { channel, connection } = await createChannel();

    try {
        // Define queues for user, media, and genre services
        const queues = ["user-service", "media-service", "genre-service"];

        for (const queue of queues) {
            await channel.assertQueue(queue, { durable: false });
            console.log(`Queue "${queue}" is ready.`);
        }        

        console.log("All necessary queues have been set up.");
    } catch (error) {
        console.error("Error setting up queues:", error);
    }
}


export const fetchDataFromQueue = async (queue: string, message: any) => {
    const { channel, connection } = await createChannel();
    const replyQueue = await channel.assertQueue("", { exclusive: true });
    const correlationId = generateUuid();

    console.log(`Sending message to queue: ${queue}`);
    console.log(`Message: ${JSON.stringify(message)}`);
    console.log(`Correlation ID: ${correlationId}`);

    return new Promise((resolve, reject) => {
        channel.consume(
            replyQueue.queue,
            (msg) => {
                if (msg && msg.properties.correlationId === correlationId) {
                    const response = JSON.parse(msg.content.toString());
                    console.log(`Received response from ${queue}:`, response);
                    resolve(response);
                    connection.close();
                } else if (!msg) {
                    reject(new Error("Received a null message from RabbitMQ"));
                }
            },
            { noAck: true }
        );

        channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
            replyTo: replyQueue.queue,
            correlationId,
        });
    });
};



function generateUuid() {
    return Math.random().toString() + Math.random().toString() + Math.random().toString();
}

(async () => {
    const genreResponse = await fetchDataFromQueue("genre-service", { reviewId: 10 });
    console.log("Genre response from RabbitMQ:", genreResponse);


    const [userResponse, mediaResponse] = await Promise.all([
        await fetchDataFromQueue("user-service", { userId: 1 }),
        await fetchDataFromQueue("media-service", { mediaId: 2 }),
        await fetchDataFromQueue("genre-service", { reviewId: 2 }),
    ]);

    console.log("User response:", userResponse);
    console.log("Media response:", mediaResponse);
    console.log("Genre response:", genreResponse);

})();
