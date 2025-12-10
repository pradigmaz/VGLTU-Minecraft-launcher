import asyncio
import logging
import os
import sys

# Настройка путей и логов
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("GC-Service")

# Импортируем логику из gc_minio, чтобы не дублировать код
try:
    from tools.gc_minio import run_gc
except ImportError:
    from gc_minio import run_gc

async def gc_scheduler():
    logger.info("⏳ Garbage Collector Service started.")
    logger.info("📅 Schedule: Every 24 hours.")
    
    # Ждем 60 секунд перед первым запуском, чтобы БД и MinIO точно поднялись
    await asyncio.sleep(60)

    while True:
        try:
            logger.info("▶ Starting daily cleanup task...")
            # Запускаем очистку
            await run_gc()
            logger.info("✅ Daily cleanup finished.")
        except Exception as e:
            logger.error(f"⚠️ GC Task Failed: {e}")
        
        # Спим 24 часа (86400 секунд) асинхронно, не блокируя поток
        await asyncio.sleep(86400)

if __name__ == "__main__":
    # Запускаем вечный асинхронный цикл
    try:
        asyncio.run(gc_scheduler())
    except KeyboardInterrupt:
        logger.info("🛑 GC Service stopped manually.")