import { Router, type IRouter } from "express";
import healthRouter from "./health";
import tecnicasRouter from "./tecnicas";
import workspacesRouter from "./workspaces";
import cargosRouter from "./cargos";

const router: IRouter = Router();

router.use(healthRouter);
// Rotas técnicas de fundação — ver o cabeçalho de `tecnicas.ts`.
router.use(tecnicasRouter);
router.use(workspacesRouter);
router.use(cargosRouter);

export default router;
