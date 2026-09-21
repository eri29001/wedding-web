// Archivo: Backend/aiLogic.js

// NOTA: La palabra 'export' al inicio es vital para que server.js lo lea
export function filtrarConIA(perfilNovia, listaProveedores) {
    let recomendados = [];
    
    // Normalizamos textos (minúsculas) para evitar errores si vienen vacíos
    const estiloNovia = (perfilNovia.estilo_boda || "").toLowerCase();
    const presupuestoNovia = (perfilNovia.presupuesto || "").toLowerCase();

    // Si no hay datos de filtro, devolvemos todo por seguridad
    if(!estiloNovia && !presupuestoNovia) return listaProveedores;

    console.log(`🤖 IA Procesando: Buscando estilo "${estiloNovia}" con presupuesto "${presupuestoNovia}"`);

    listaProveedores.forEach(proveedor => {
        try {
            let score = 0;
            // Verificamos que el proveedor tenga datos
            const estilosProveedor = (proveedor.estilo || "").toLowerCase();
            const presProv = (proveedor.presupuesto || "").toLowerCase();

            // 1. Coincidencia de Estilo
            if (estilosProveedor.includes(estiloNovia)) score += 5;
            
            // 2. Coincidencia de Presupuesto
            if (presProv === presupuestoNovia) score += 3;
            else if (presupuestoNovia === 'alto' && presProv === 'medio') score += 2;

            // 3. Umbral de recomendación (Si supera el puntaje, lo agregamos)
            if (score >= 3) {
                let provFormat = { ...proveedor };
                // Convertimos el texto "boho,playa" en una lista ["boho", "playa"]
                provFormat.estilo = proveedor.estilo ? proveedor.estilo.split(',') : [];
                recomendados.push(provFormat);
            }
        } catch (e) {
            console.error("Error procesando proveedor:", e);
        }
    });

    return recomendados;
}