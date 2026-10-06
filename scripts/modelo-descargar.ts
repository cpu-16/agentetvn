// Descarga una sola vez el modelo de embeddings a ./.cache-modelos (requiere internet). Después, todo corre offline.
process.env.HF_HUB_OFFLINE = "0";
const { embeber, MODELO } = await import("../src/lib/motor/embeddings");
await embeber(["prueba"], "query");
console.log(`${MODELO} listo en ./.cache-modelos`);
