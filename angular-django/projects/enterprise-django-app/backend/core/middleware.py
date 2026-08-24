import uuid
import structlog
from django.utils.deprecation import MiddlewareMixin

CORRELATION_HEADER = 'HTTP_X_REQUEST_ID'

class CorrelationIdMiddleware(MiddlewareMixin):
    def process_request(self, request):
        trace_id = request.META.get(CORRELATION_HEADER) or str(uuid.uuid4())
        request.trace_id = trace_id
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(trace_id=trace_id)

    def process_response(self, request, response):
        trace_id = getattr(request, 'trace_id', None)
        if trace_id:
            response['X-Request-ID'] = trace_id
        return response
