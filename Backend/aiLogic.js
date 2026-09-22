// Archivo: Backend/aiLogic.js

export function filtrarConIA(perfilNovia = {}, listaProveedores = []) {
    if (!Array.isArray(listaProveedores) || listaProveedores.length === 0) {
        return [];
    }

    // 1. Normalización con soporte dual (Base de Datos PostgreSQL y DTOs anteriores)
    const estiloNovia = (perfilNovia.estilos_preferidos || perfilNovia.estilo_boda || "").toLowerCase();
    const presupuestoNovia = (perfilNovia.presupuesto || "").toString().toLowerCase();
    const limitePresupuesto = parseFloat(perfilNovia.budget_limit || perfilNovia.presupuesto) || 0;

    // Si no hay filtros configurados, devolvemos todo con formato de array seguro
    if (!estiloNovia && !presupuestoNovia && limitePresupuesto === 0) {
        return listaProveedores.map(p => ({
            ...p,
            estilo: Array.isArray(p.estilo) ? p.estilo : (p.estilo ? p.estilo.split(',').map(e => e.trim()) : []),
            score: 0
        }));
    }

    console.log(`🤖 IA Procesando: Evaluando recomendaciones para estilo "${estiloNovia}"`);

    // 2. Mapeo y scoring seguro
    const procesados = listaProveedores.map(proveedor => {
        let score = 0;

        const estilosProveedor = (
            Array.isArray(proveedor.estilo) 
                ? proveedor.estilo.join(',') 
                : (proveedor.estilo || "")
        ).toLowerCase();
        
        const presProvTexto = (proveedor.presupuesto || "").toString().toLowerCase();
        const costoProv = parseFloat(proveedor.costo) || 0;

        // --- Criterio A: Coincidencia por Estilo ---
        if (estiloNovia && estilosProveedor) {
            const listaEstilosNovia = estiloNovia.split(',').map(e => e.trim());
            const tieneCoincidencia = listaEstilosNovia.some(estilo => estilo && estilosProveedor.includes(estilo));
            if (tieneCoincidencia) score += 50;
        }

        // --- Criterio B: Coincidencia por Presupuesto Numérico (Neon DB) ---
        if (limitePresupuesto > 0 && costoProv > 0) {
            if (costoProv <= limitePresupuesto) score += 40;
            else if (costoProv <= limitePresupuesto * 1.15) score += 20; // Margen de tolerancia del 15%
        } else if (presupuestoNovia && presProvTexto) {
            // --- Criterio C: Coincidencia Cualitativa ('alto', 'medio', 'bajo') ---
            if (presProvTexto === presupuestoNovia) score += 30;
            else if (presupuestoNovia === 'alto' && presProvTexto === 'medio') score += 20;
        }

        // Normalización del campo 'estilo' para evitar errores en el Frontend
        let estiloArray = [];
        if (Array.isArray(proveedor.estilo)) {
            estiloArray = proveedor.estilo;
        } else if (typeof proveedor.estilo === 'string' && proveedor.estilo.trim() !== '') {
            estiloArray = proveedor.estilo.split(',').map(e => e.trim());
        }

        return {
            ...proveedor,
            estilo: estiloArray,
            score: score,
            matchPercentage: Math.min(score, 100) // Atributo útil para mostrar insignias (ej: "Match 90%")
        };
    });

    // 3. Ordenar descendentemente: Los proveedores con mejor puntuación van primero
    procesados.sort((a, b) => b.score - a.score);

    return procesados;
}