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
import incidentsRoutes from './routes/incidentsRoutes.js';
import seatingRoutes from './routes/seatingRoutes.js';
import documentRoutes from './routes/documentRoutes.js';
import auditRoutes from './routes/auditRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de Middlewares globales
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health Check Endpoint (útil para el monitoreo de Render)
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// Definición y Registro de Endpoints Modularizados
app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/checklist', checklistRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/providers', providerRoutes);
app.use('/api/privacy', privacyRoutes);
app.use('/api/incidents', incidentsRoutes);

// Manejo de Rutas No Encontradas (404)
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Endpoint no encontrado.' });
});

// Middleware Global de Manejo de Errores (500)
app.use((err, req, res, next) => {
    console.error('💥 Error global no capturado:', err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Error interno del servidor.'
    });
});

// Inicialización de la BD y Arranque del Servidor
const startServer = async () => {
    try {
        console.log('🔄 Inicializando base de datos en Neon...');
        await inicializarBaseDeDatos();
        
        app.listen(PORT, () => {
            console.log(`\n✨ SERVIDOR MODULAR EJECUTÁNDOSE EN PUERTO: ${PORT}`);
        });
    } catch (error) {
        console.error('❌ Error crítico al iniciar la aplicación:', error);
        process.exit(1);
    }
};

startServer();