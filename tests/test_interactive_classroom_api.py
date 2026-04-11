from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from open_notebook.exceptions import NetworkError, NotFoundError


@pytest.fixture
def client():
    from api.main import app

    return TestClient(app)


class TestInteractiveClassroomSummary:
    @patch("api.routers.interactive_classroom.transformation_graph")
    def test_summary_removes_drawio_xml(self, mock_graph, client):
        mock_graph.ainvoke = AsyncMock(return_value={"output": "整理后的课堂需求"})

        response = client.post(
            "/api/interactive-classroom/summary",
            json={
                "title": "测试标题",
                "content": (
                    "这是笔记正文。\n\n"
                    "<!-- drawio:start -->\n"
                    "<mxfile>diagram</mxfile>\n"
                    "<!-- drawio:end -->"
                ),
                "language": "zh-CN",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["summary"] == "整理后的课堂需求"
        assert data["cleaned_content"] == "这是笔记正文。"
        assert data["language"] == "zh-CN"

        invocation = mock_graph.ainvoke.await_args.args[0]
        assert invocation["transformation"].name == "interactive_classroom_summary"
        assert "<mxfile>" not in invocation["input_text"]
        assert "测试标题" in invocation["input_text"]
        assert "这是笔记正文。" in invocation["input_text"]

    def test_summary_rejects_empty_content_after_cleanup(self, client):
        response = client.post(
            "/api/interactive-classroom/summary",
            json={
                "content": (
                    "<!-- drawio:start -->\n"
                    "<mxfile>diagram</mxfile>\n"
                    "<!-- drawio:end -->"
                )
            },
        )

        assert response.status_code == 400
        assert (
            response.json()["detail"]
            == "Note content is empty after removing diagram data"
        )


class TestInteractiveClassroomJobs:
    @patch(
        "api.routers.interactive_classroom._request_openmaic_json",
        new_callable=AsyncMock,
    )
    def test_create_job_maps_summary_and_cleaned_content(self, mock_request, client):
        mock_request.return_value = {
            "jobId": "job_123",
            "status": "queued",
            "step": "queued",
            "message": "Preparing classroom",
            "pollIntervalMs": 5000,
        }

        response = client.post(
            "/api/interactive-classroom/jobs",
            json={
                "summary": "根据这份笔记生成课堂",
                "original_content": (
                    "第一段正文\n\n"
                    "<!-- drawio:start -->\n"
                    "<mxfile>diagram</mxfile>\n"
                    "<!-- drawio:end -->"
                ),
                "language": "en-US",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["job_id"] == "job_123"
        assert data["status"] == "queued"
        assert data["message"] == "Preparing classroom"
        assert data["poll_interval_ms"] == 5000
        assert data["done"] is False

        _, _, payload = mock_request.await_args.args
        assert payload["requirement"] == "根据这份笔记生成课堂"
        assert payload["pdfContent"]["text"] == "第一段正文"
        assert payload["pdfContent"]["images"] == []
        assert payload["language"] == "en-US"

    @patch(
        "api.routers.interactive_classroom._request_openmaic_json",
        new_callable=AsyncMock,
    )
    def test_get_job_status_maps_result_url(self, mock_request, client):
        mock_request.return_value = {
            "status": "completed",
            "step": "completed",
            "message": "Classroom ready",
            "progress": 100,
            "pollIntervalMs": 5000,
            "done": True,
            "result": {
                "classroomId": "abc123",
                "url": "https://open.maic.chat/classroom/abc123",
            },
        }

        response = client.get("/api/interactive-classroom/jobs/job_123")

        assert response.status_code == 200
        data = response.json()
        assert data["job_id"] == "job_123"
        assert data["status"] == "completed"
        assert data["poll_interval_ms"] == 5000
        assert data["result_url"] == "https://open.maic.chat/classroom/abc123"
        assert data["done"] is True

    @patch(
        "api.routers.interactive_classroom._request_openmaic_json",
        new_callable=AsyncMock,
    )
    def test_get_job_status_returns_404_when_remote_job_missing(
        self, mock_request, client
    ):
        mock_request.side_effect = NotFoundError("Classroom generation job not found")

        response = client.get("/api/interactive-classroom/jobs/job_missing")

        assert response.status_code == 404
        assert response.json()["detail"] == "Classroom generation job not found"

    @patch(
        "api.routers.interactive_classroom._request_openmaic_json",
        new_callable=AsyncMock,
    )
    def test_create_job_returns_502_when_openmaic_times_out(
        self, mock_request, client
    ):
        mock_request.side_effect = NetworkError("OpenMAIC request timed out")

        response = client.post(
            "/api/interactive-classroom/jobs",
            json={
                "summary": "课程总结",
                "original_content": "这里有可发送的正文",
            },
        )

        assert response.status_code == 502
        assert response.json()["detail"] == "OpenMAIC request timed out"
