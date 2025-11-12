# GGUF Model Refresh & Validation Guide

This runbook covers how to swap the on-disk Mistral GGUF weights that power `api/mistral_server.py`, plus the validation steps to run before putting the FastAPI service back in front of Discord traffic.

## Components & Paths
- **Model consumer**: `api/mistral_server.py` loads the weights through `llama_cpp.Llama` during the FastAPI `startup_event`.
- **Weight path**: `model/mistral-7b-instruct-v0.2.Q4_K_M.gguf` (resolved relative to the repo root). The filename is currently hard-coded; either keep the same name or update the `model_path` assignment if you want to keep versioned filenames.
- **GPU helpers**: `api/utils/gpu.py` clears CUDA memory and applies RTX 2060 Super defaults (`optimize_for_rtx2060`).
- **Service entry point**: `uvicorn mistral_server:app --host 0.0.0.0 --port 8000` (typically run from the `api/` folder).

## Prerequisites
1. At least 4 GB of free disk space for the new GGUF file (Q4_K_M).
2. Hugging Face CLI or another downloader with access to the desired release (e.g., `mistralai/Mistral-7B-Instruct-v0.2`).
3. Checksum published by the upstream release (SHA256 recommended).
4. Ability to stop/restart the FastAPI service (local shell or systemd/PM2, depending on deployment).

## Refresh Procedure
1. **Quiesce the service**
   - Stop anything invoking `/analyze`.
   - Shut down the FastAPI process (Ctrl+C in the terminal or `pm2 stop mistral-server` / `systemctl stop mistral.service` depending on your setup).
   - Confirm the process is down (`netstat -ano | findstr 8000` on Windows or `lsof -i :8000` on Unix).

2. **Download the new GGUF weights**
   - Example (Hugging Face CLI):
     ```bash
     cd CopyTradeV2/model
     huggingface-cli download mistralai/Mistral-7B-Instruct-v0.2 \
       --include 'mistral-7b-instruct-v0.2.Q4_K_M.gguf' \
       --local-dir .
     ```
   - Or use `wget`/`curl` against the direct URL provided by the release notes.

3. **Verify integrity**
   - Compare the SHA256 hash against the value published upstream:
     ```bash
     shasum -a 256 mistral-7b-instruct-v0.2.Q4_K_M.gguf
     # On Windows PowerShell:
     Get-FileHash .\mistral-7b-instruct-v0.2.Q4_K_M.gguf -Algorithm SHA256
     ```
   - Abort if the hash does not match.

4. **Stage & swap**
   - Back up the previous file for rollback:
     ```bash
     mv mistral-7b-instruct-v0.2.Q4_K_M.gguf mistral-7b-instruct-v0.2.Q4_K_M.gguf.bak
     ```
     (On Windows: `Rename-Item mistral-7b-instruct-v0.2.Q4_K_M.gguf *.bak`.)
   - Move/rename the freshly downloaded file to `model/mistral-7b-instruct-v0.2.Q4_K_M.gguf`. If you prefer versioned filenames, update `model_path` inside `api/mistral_server.py` to point at the new filename instead of renaming.

5. **Reactivate the Python virtual environment**
   ```bash
   cd CopyTradeV2/api
   # Windows PowerShell
   .\venv\Scripts\Activate.ps1
   # macOS/Linux
   # source venv/bin/activate
   ```

6. **Restart the FastAPI service**
   ```bash
   uvicorn mistral_server:app --host 0.0.0.0 --port 8000
   ```
   Watch the logs for:
   - `Model initialized successfully`
   - GPU info printout (confirms CUDA sees the card)
   - No `llama.cpp` warnings about invalid tensors or metadata

7. **Validate**
   - **Health check**:
     ```bash
     curl http://localhost:8000/health
     ```
     Ensure `status` is `"healthy"` and `channel_analyzer` is `initialized`.
   - **Smoke inference**: send a representative payload to `/analyze` and confirm a structured response arrives within expected latency.
     ```bash
     curl -X POST http://localhost:8000/analyze \
       -H "Content-Type: application/json" \
       -d '{ "content": "QQQ 450C @1.20 scalp idea" }'
     ```
   - **GPU sanity**: monitor VRAM usage (`nvidia-smi` or `torch.cuda.memory_allocated`) to ensure the new quantization fits the RTX 2060 Super defaults. If it does not, adjust `optimize_for_rtx2060()` or add a new preset in `api/utils/gpu.py`.

8. **Return traffic**
   - Once the checks pass, bring the Discord worker back online (`npm run start-secure` or the relevant process manager).
   - Watch the shared logs (`api/data/logs/trade_history.json`, `data/logs/api.log`) for the next few messages to ensure outputs look normal.

## Rollback
1. Stop the FastAPI service again.
2. Restore the previous GGUF:
   ```bash
   mv model/mistral-7b-instruct-v0.2.Q4_K_M.gguf.bak \
      model/mistral-7b-instruct-v0.2.Q4_K_M.gguf
   ```
3. Restart the service and re-run the validation steps.

## Tips & Troubleshooting
- **Memory errors**: Decrease `n_gpu_layers` or `n_batch` in `api/utils/gpu.py` if the new file is larger than the previous quantization.
- **Warm start**: `clear_gpu_memory()` already runs at startup, but you can manually run `nvidia-smi --gpu-reset` (where supported) if CUDA gets stuck.
- **Multiple models**: If you plan to keep several GGUF variants, consider adding an environment variable (e.g., `LLM_MODEL_PATH`) and reading it in `mistral_server.py` instead of editing the code every swap.
- **Automation**: Once the manual flow is stable, wrap it into a script (`scripts/refresh-model.ps1/.sh`) to fetch, verify, and swap with fewer manual steps.
