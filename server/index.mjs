import {createRealtimeServer} from './realtime.mjs';
const port=Number(process.env.PORT)||8787;
const allowedOrigins=(process.env.ALLOWED_ORIGINS??'').split(',').map(s=>s.trim()).filter(Boolean);
const trustProxy=process.env.TRUST_PROXY==='1';
const server=createRealtimeServer({port,allowedOrigins,trustProxy});
await server.ready;
console.log(`NIRVANA shared lake listening on ws://localhost:${server.port()}${allowedOrigins.length?` (origins: ${allowedOrigins.join(', ')})`:' (any origin — set ALLOWED_ORIGINS in production)'}`);
const stop=async()=>{await server.close();process.exit(0);};
process.on('SIGINT',stop);process.on('SIGTERM',stop);
