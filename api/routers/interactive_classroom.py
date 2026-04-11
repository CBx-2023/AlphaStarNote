import os
import re
from urllib.parse import urljoin

import httpx
from fastapi import APIRouter
from loguru import logger

from api.models import (
    InteractiveClassroomJobCreateRequest,
    InteractiveClassroomJobCreateResponse,
    InteractiveClassroomJobStatusResponse,
    InteractiveClassroomSummaryRequest,
    InteractiveClassroomSummaryResponse,
)
from open_notebook.domain.transformation import Transformation
from open_notebook.exceptions import (
    ExternalServiceError,
    InvalidInputError,
    NetworkError,
    NotFoundError,
)
from open_notebook.graphs.transformation import graph as transformation_graph

router = APIRouter()

DRAWIO_REGEX = re.compile(
    r"<!-- drawio:start -->\n([\s\S]*?)\n<!-- drawio:end -->", re.MULTILINE
)
OPENMAIC_BASE_URL = os.getenv("OPENMAIC_BASE_URL", "https://open.maic.chat").rstrip(
    "/"
)


def _normalize_language(language: str | None) -> str:
    normalized = (language or "").strip().lower()
    return "zh-CN" if normalized.startswith("zh") else "en-US"


def _remove_drawio_xml(content: str) -> str:
    return DRAWIO_REGEX.sub("", content).strip()


def _build_summary_input(title: str | None, cleaned_content: str) -> str:
    sections: list[str] = []

    if title and title.strip():
        sections.append(f"# Note Title\n{title.strip()}")

    sections.append(f"# Note Content\n{cleaned_content}")
    return "\n\n".join(sections)


def _build_summary_prompt(language: str) -> str:
    if language == "zh-CN":
        return (
            "请把这份笔记整理成可直接交给“交互网课”系统的课程需求说明。"
            "输出纯文本，不要使用代码块。"
            "内容需要清晰覆盖学习目标、核心主题、适合的互动方式、"
            "以及笔记中必须保留的重要上下文或约束。"
            "写成紧凑、可执行的课程需求描述。"
        )

    return (
        "Turn this note into a concise classroom requirement that can be sent "
        "directly to an interactive classroom generation system. Output plain "
        "text only, with no code fences. Cover learning goals, core topics, "
        "suggested interactive activities, and any important context or "
        "constraints that must be preserved."
    )


def _extract_remote_detail(response: httpx.Response) -> str:
    try:
        payload = response.json()
    except ValueError:
        return response.text or "OpenMAIC request failed"

    if isinstance(payload, dict):
        detail = payload.get("error") or payload.get("message") or payload.get("detail")
        if isinstance(detail, str) and detail.strip():
            return detail.strip()

    return response.text or "OpenMAIC request failed"


def _extract_result_url(payload: dict) -> str | None:
    result = payload.get("result")
    if not isinstance(result, dict):
        return None

    raw_url = result.get("url")
    if isinstance(raw_url, str) and raw_url.strip():
        if raw_url.startswith("http://") or raw_url.startswith("https://"):
            return raw_url.strip()
        return urljoin(f"{OPENMAIC_BASE_URL}/", raw_url.lstrip("/"))

    classroom_id = result.get("classroomId")
    if isinstance(classroom_id, str) and classroom_id.strip():
        return f"{OPENMAIC_BASE_URL}/classroom/{classroom_id.strip()}"

    return None


def _normalize_job_response(job_id: str, payload: dict) -> dict:
    status = str(payload.get("status") or "pending")
    error = payload.get("error")
    return {
        "job_id": job_id,
        "status": status,
        "step": payload.get("step"),
        "message": payload.get("message"),
        "progress": payload.get("progress"),
        "done": bool(payload.get("done", status in {"completed", "failed", "canceled"})),
        "result_url": _extract_result_url(payload),
        "error": error if isinstance(error, str) else None,
    }


async def _request_openmaic_json(
    method: str, path: str, payload: dict | None = None
) -> dict:
    url = f"{OPENMAIC_BASE_URL}{path}"
    timeout = httpx.Timeout(60.0, connect=15.0)

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.request(method=method, url=url, json=payload)
    except httpx.TimeoutException as exc:
        raise NetworkError("OpenMAIC request timed out") from exc
    except httpx.RequestError as exc:
        raise NetworkError("Unable to reach OpenMAIC") from exc

    if response.status_code == 404:
        raise NotFoundError(_extract_remote_detail(response))

    if response.status_code >= 400:
        raise ExternalServiceError(_extract_remote_detail(response))

    try:
        data = response.json()
    except ValueError as exc:
        raise ExternalServiceError("OpenMAIC returned an invalid response") from exc

    if not isinstance(data, dict):
        raise ExternalServiceError("OpenMAIC returned an unexpected response")

    return data


@router.post(
    "/interactive-classroom/summary",
    response_model=InteractiveClassroomSummaryResponse,
)
async def generate_interactive_classroom_summary(
    request: InteractiveClassroomSummaryRequest,
):
    cleaned_content = _remove_drawio_xml(request.content)
    if not cleaned_content:
        raise InvalidInputError("Note content is empty after removing diagram data")

    normalized_language = _normalize_language(request.language)
    transformation = Transformation(
        name="interactive_classroom_summary",
        title="Interactive Classroom Summary",
        description="Summarize note content for OpenMAIC classroom generation",
        prompt=_build_summary_prompt(normalized_language),
        apply_default=False,
    )

    logger.info("Generating interactive classroom summary")
    result = await transformation_graph.ainvoke(
        {
            "input_text": _build_summary_input(request.title, cleaned_content),
            "transformation": transformation,
        }
    )

    summary = str(result.get("output", "")).strip()
    if not summary:
        raise ExternalServiceError("No classroom summary was generated")

    return InteractiveClassroomSummaryResponse(
        summary=summary,
        cleaned_content=cleaned_content,
        language=normalized_language,
    )


@router.post(
    "/interactive-classroom/jobs",
    response_model=InteractiveClassroomJobCreateResponse,
)
async def create_interactive_classroom_job(
    request: InteractiveClassroomJobCreateRequest,
):
    summary = request.summary.strip()
    if not summary:
        raise InvalidInputError("Classroom summary cannot be empty")

    cleaned_content = _remove_drawio_xml(request.original_content)
    if not cleaned_content:
        raise InvalidInputError("Note content is empty after removing diagram data")

    normalized_language = _normalize_language(request.language)
    payload = await _request_openmaic_json(
        "POST",
        "/api/generate-classroom",
        {
            "requirement": summary,
            "pdfContent": {
                "text": cleaned_content,
                "images": [],
            },
            "language": normalized_language,
        },
    )

    job_id = payload.get("jobId")
    if not isinstance(job_id, str) or not job_id.strip():
        raise ExternalServiceError("OpenMAIC did not return a job ID")

    return InteractiveClassroomJobCreateResponse(
        **_normalize_job_response(job_id.strip(), payload)
    )


@router.get(
    "/interactive-classroom/jobs/{job_id}",
    response_model=InteractiveClassroomJobStatusResponse,
)
async def get_interactive_classroom_job_status(job_id: str):
    if not job_id.strip():
        raise InvalidInputError("Job ID cannot be empty")

    payload = await _request_openmaic_json(
        "GET", f"/api/generate-classroom/{job_id.strip()}"
    )
    return InteractiveClassroomJobStatusResponse(
        **_normalize_job_response(job_id.strip(), payload)
    )
