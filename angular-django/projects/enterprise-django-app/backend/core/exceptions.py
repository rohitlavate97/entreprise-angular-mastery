import datetime
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status

def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)
    request = context.get('request')
    trace_id = getattr(request, 'trace_id', 'N/A') if request else 'N/A'

    if response is not None:
        field_errors = []
        message = "An error occurred while processing your request."

        if isinstance(response.data, dict):
            if 'detail' in response.data:
                message = str(response.data['detail'])
            else:
                for field, errors in response.data.items():
                    error_msg = errors[0] if isinstance(errors, list) else str(errors)
                    field_errors.append({
                        "field": field,
                        "message": error_msg
                    })
                message = "Validation failed for one or more fields."
        elif isinstance(response.data, list):
            message = response.data[0] if response.data else message

        custom_data = {
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "status": response.status_code,
            "errorCode": getattr(exc, 'default_code', 'API_ERROR').upper(),
            "message": message,
            "fieldErrors": field_errors if field_errors else None,
            "traceId": trace_id,
        }
        return Response(custom_data, status=response.status_code)

    return Response({
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "status": status.HTTP_500_INTERNAL_SERVER_ERROR,
        "errorCode": "INTERNAL_SERVER_ERROR",
        "message": "An unexpected server error occurred. Please contact support quoting the trace ID.",
        "fieldErrors": None,
        "traceId": trace_id
    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
