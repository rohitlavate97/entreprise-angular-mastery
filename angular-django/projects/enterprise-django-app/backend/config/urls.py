from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from core.views import UserViewSet, TransferViewSet, HealthCheckView, CustomTokenObtainPairView

router = DefaultRouter(trailing_slash=True)
router.register(r'users', UserViewSet, basename='user')
router.register(r'transfers', TransferViewSet, basename='transfer')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/health/ping/', HealthCheckView.as_view(), name='health-ping'),
    path('api/v1/auth/login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/v1/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/v1/', include(router.urls)),
]
