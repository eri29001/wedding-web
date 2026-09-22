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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));

// Inicialización de la Base de Datos
inicializarBaseDeDatos();

// Definición de Endpoints
app.use('/api', authRoutes);
app.use('/api', aiRoutes);
app.use('/api', calendarRoutes);
app.use('/api', checklistRoutes);
app.use('/api', profileRoutes);
app.use('/api', providerRoutes);

app.listen(PORT, () => {
    console.log(`\n✨ SERVIDOR MODULAR EJECUTÁNDOSE EN PUERTO: ${PORT}`);
});