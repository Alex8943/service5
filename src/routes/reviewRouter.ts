import express from "express";
import { Review as Reviews } from "../other_services/model/seqModel";
import logger from "../other_services/winstonLogger";
import { fetchDataFromQueue } from "../other_services/rabbitMQ";
import verifyUser from "./authenticateUser";

const router = express.Router();

// Get one review by ID
router.get("/review/:id", verifyUser, async (req, res) => {
    try {
        const reviewId = parseInt(req.params.id, 10);
        console.log(`Fetching review with ID: ${reviewId}`);

        const review = await getOneReview(reviewId);

        if (!review) {
            res.status(404).send({ error: `No review found with ID ${reviewId}` });
            return;
        }

        res.status(200).json(review); // Send enriched review to the client
    } catch (error) {
        console.error("Error fetching review:", error);
        res.status(500).send("Something went wrong while fetching the review");
    }
});

export async function getOneReview(id: number) {
    try {
        // Fetch the review from the database
        const review = await Reviews.findOne({
            where: {id: id}, // Fetch only active reviews
        });

        if (!review) {
            console.log(`No review found with ID: ${id}`);
            return null;
        }

        console.log("Fetched review from database:", review);

        // Enrich the review with user, media, and genre data from RabbitMQ
        const [user, media, genres] = await Promise.all([
            fetchDataFromQueue("user-service", { userId: review.user_fk }),
            fetchDataFromQueue("media-service", { mediaId: review.media_fk }),
            fetchDataFromQueue("genre-service", { reviewId: review.id }),
        ]);

        const enrichedReview = {
            id: review.id,
            title: review.title,
            description: review.description,
            createdAt: review.createdAt,
            updatedAt: review.updatedAt,
            user: user || { error: "User not found" },
            media: media || { error: "Media not found" },
            genres: genres || [],
        };

        console.log("Enriched review:", enrichedReview);

        return enrichedReview;
    } catch (error) {
        console.error("Error fetching review:", error);
        throw error;
    }
}

export default router;
