import { Router, type IRouter } from "express";
import healthRouter from "./health";
import transcriptRouter from "./transcript";

const router: IRouter = Router();

router.use(healthRouter);
router.use(transcriptRouter);

export default router;
