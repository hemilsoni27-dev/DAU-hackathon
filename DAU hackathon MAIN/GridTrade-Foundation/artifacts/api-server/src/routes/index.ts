import { Router, type IRouter } from "express";
import healthRouter from "./health";
import gridtradeRouter from "./gridtrade";
import demoRouter from "./demo";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/v1/demo", demoRouter);
router.use(gridtradeRouter);

export default router;
