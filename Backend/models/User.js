const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['planner', 'novia'], default: 'novia' },
    
    // CAMPOS PARA RECUPERACIÓN DE CONTRASEÑA
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);