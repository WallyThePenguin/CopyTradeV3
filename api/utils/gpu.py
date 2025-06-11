import torch
import gc
import logging

logger = logging.getLogger(__name__)

def clear_gpu_memory():
    """Clear GPU memory and run garbage collection"""
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        gc.collect()
        logger.info("GPU memory cleared")

def get_gpu_info():
    """Get GPU information"""
    if not torch.cuda.is_available():
        return {"available": False}
    
    device = torch.cuda.current_device()
    return {
        "available": True,
        "device": device,
        "name": torch.cuda.get_device_name(device),
        "memory_allocated": torch.cuda.memory_allocated(device) / 1024**2,  # MB
        "memory_reserved": torch.cuda.memory_reserved(device) / 1024**2,    # MB
        "max_memory": torch.cuda.get_device_properties(device).total_memory / 1024**2  # MB
    }

def optimize_for_rtx2060():
    """Return optimal settings for RTX 2060 Super"""
    return {
        "n_ctx": 2048,          # Reduced context for memory
        "n_threads": 8,         # CPU threads
        "n_batch": 512,         # Reduced batch size for memory
        "n_gpu_layers": 35,     # Full GPU layers for RTX 2060 Super
        "offload_kqv": True,    # Offload key/query/value matrices
    } 