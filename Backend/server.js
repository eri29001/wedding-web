import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { inicializarBaseDeDatos } from './models/initDb.js';

// Importación de Rutas
import authRoutes from './routes/authRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import calendarRoutes from './routes/calendarRoutes.js';
import checklistRoutes from './routes/checklistRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import providerRoutes from './routes/providerRoutes.js';
import privacyRoutes from './routes/privacyRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de Middlewares
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));

// Inicialización de la Base de Datos (PostgreSQL en Neon)
inicializarBaseDeDatos();

// Definición y Registro de Endpoints
app.use('/api', authRoutes);
app.use('/api', aiRoutes);
app.use('/api', calendarRoutes);
app.use('/api', checklistRoutes);
app.use('/api', profileRoutes);
app.use('/api', providerRoutes);
app.use('/api', privacyRoutes);

app.listen(PORT, () => {
    console.log(`\n✨ SERVIDOR MODULAR EJECUTÁNDOSE EN PUERTO: ${PORT}`);
});