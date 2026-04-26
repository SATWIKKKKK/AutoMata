import asyncio
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def run_worker():
    logger.info("Automata Worker starting...")
    while True:
        await asyncio.sleep(60)
        logger.info("Worker heartbeat")

if __name__ == "__main__":
    asyncio.run(run_worker())
