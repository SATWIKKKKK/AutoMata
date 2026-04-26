import asyncio
import json
from dataclasses import dataclass
from typing import Dict, Any, Optional
from temporalio import activity
from anthropic import AsyncAnthropic, APIError
from jinja2 import Template
import structlog
from app.core.config import settings
from app.core.redis import redis_client

logger = structlog.get_logger()

@dataclass
class LLMNodeInput:
    node_config: Dict[str, Any]
    input_data: Dict[str, Any]
    run_id: str
    node_id: str

@dataclass
class LLMNodeOutput:
    output_text: str
    tokens_used: int
    cost_inr: float
    duration_ms: int

async def publish_update(run_id: str, node_id: str, status: str, output: Optional[Dict] = None, tokens: int = 0, cost: float = 0.0, duration: int = 0):
    redis = await redis_client.get_client()
    payload = {
        "node_id": node_id,
        "status": status,
        "output": output,
        "tokens_used": tokens,
        "cost_inr": cost,
        "duration_ms": duration
    }
    await redis.publish(f"run:{run_id}:updates", json.dumps(payload))

def calculate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    usd_to_inr = 84.0
    if "haiku" in model.lower():
        cost_usd = (input_tokens / 1_000_000) * 0.80 + (output_tokens / 1_000_000) * 4.00
    elif "sonnet" in model.lower():
        cost_usd = (input_tokens / 1_000_000) * 3.00 + (output_tokens / 1_000_000) * 15.00
    else:
        cost_usd = 0.0
    return round(cost_usd * usd_to_inr, 4)

@activity.defn
async def execute_llm_node(input_data: LLMNodeInput) -> LLMNodeOutput:
    start_time = asyncio.get_event_loop().time()
    
    config = input_data.node_config
    model = config.get("model", "claude-3-5-haiku-20241022")
    system_prompt_tpl = Template(config.get("system_prompt", ""))
    input_tpl = Template(config.get("input_template", ""))
    max_tokens = config.get("max_tokens", 1000)
    temperature = config.get("temperature", 0.0)
    
    system_prompt = system_prompt_tpl.render(**input_data.input_data)
    user_message = input_tpl.render(**input_data.input_data)
    
    client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    
    retries = 3
    delays = [2, 4, 8]
    
    for attempt in range(retries + 1):
        try:
            response = await client.messages.create(
                model=model,
                max_tokens=max_tokens,
                temperature=temperature,
                system=system_prompt,
                messages=[{"role": "user", "content": user_message}]
            )
            break
        except APIError as e:
            if attempt < retries:
                logger.warning("anthropic_api_error_retry", run_id=input_data.run_id, node_id=input_data.node_id, attempt=attempt+1, error=str(e))
                await asyncio.sleep(delays[attempt])
            else:
                logger.error("anthropic_api_error_final", run_id=input_data.run_id, node_id=input_data.node_id, error=str(e))
                await publish_update(input_data.run_id, input_data.node_id, "failed")
                raise e

    input_tokens = response.usage.input_tokens
    output_tokens = response.usage.output_tokens
    total_tokens = input_tokens + output_tokens
    cost_inr = calculate_cost(model, input_tokens, output_tokens)
    
    output_text = response.content[0].text
    end_time = asyncio.get_event_loop().time()
    duration_ms = int((end_time - start_time) * 1000)
    
    await publish_update(
        run_id=input_data.run_id,
        node_id=input_data.node_id,
        status="completed",
        output={"text": output_text},
        tokens=total_tokens,
        cost=cost_inr,
        duration=duration_ms
    )
    
    return LLMNodeOutput(
        output_text=output_text,
        tokens_used=total_tokens,
        cost_inr=cost_inr,
        duration_ms=duration_ms
    )
