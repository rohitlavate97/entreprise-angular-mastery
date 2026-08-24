import uuid
import datetime
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView
from django.db import transaction
from django.db.models import Q
from .models import User, Transfer
from .serializers import UserSerializer, UserCreateSerializer, TransferSerializer, CustomTokenObtainPairSerializer

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

class HealthCheckView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({
            "status": "UP",
            "service": "enterprise-django-backend",
            "version": "1.0.0",
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "details": {
                "environment": "production",
                "framework": "Django 5.1 / DRF 3.15",
                "database": "PostgreSQL 16",
                "asyncQueue": "Celery 5.4 + Redis 7"
            }
        })

class UserViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer

    def get_queryset(self):
        queryset = User.objects.all().order_by('-created_at')
        query = self.request.query_params.get('query')
        role = self.request.query_params.get('role')

        if query:
            queryset = queryset.filter(Q(username__icontains=query) | Q(email__icontains=query))
        if role:
            queryset = queryset.filter(roles__contains=role)

        return queryset

class TransferViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = TransferSerializer

    def get_queryset(self):
        # Prevent N+1 queries by prefetching user records
        return Transfer.objects.select_related('user') \
                               .filter(user=self.request.user) \
                               .order_by('-created_at')

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        idempotency_key = request.headers.get('X-Idempotency-Key')

        # -------------------------------------------------------------
        # Backend Idempotency Deduplication Check
        # -------------------------------------------------------------
        if idempotency_key:
            existing = Transfer.objects.filter(idempotency_key=idempotency_key).first()
            if existing:
                serializer = self.get_serializer(existing)
                return Response(serializer.data, status=status.HTTP_200_OK)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        reference_id = f"TX-DJ-{uuid.uuid4().hex[:8].upper()}"
        transfer = serializer.save(
            user=request.user,
            reference_id=reference_id,
            idempotency_key=idempotency_key,
            status='COMPLETED'
        )

        return Response(self.get_serializer(transfer).data, status=status.HTTP_201_CREATED)
