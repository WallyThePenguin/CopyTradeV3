import logging
from pathlib import Path

# Ensure log directory exists under project root
log_dir = Path(__file__).resolve().parents[2] / 'data' / 'logs'
log_dir.mkdir(parents=True, exist_ok=True)

log_file = log_dir / 'api.log'

logger = logging.getLogger('api')
logger.setLevel(logging.INFO)

if not logger.handlers:
    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')

    file_handler = logging.FileHandler(log_file)
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)
    logger.addHandler(stream_handler)
