import { Router, type IRouter } from "express";
import healthRouter from "./health";
import tecnicasRouter from "./tecnicas";

const router: IRouter = Router();

router.use(healthRouter);
// Rotas técnicas de fundação — ver o cabeçalho de `tecnicas.ts`.
router.use(tecnicasRouter);

export default router;
