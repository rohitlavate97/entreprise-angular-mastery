from django.db import models
from django.contrib.auth.models import AbstractUser

class Role(models.TextChoices):
    USER = 'ROLE_USER', 'User'
    MANAGER = 'ROLE_MANAGER', 'Manager'
    ADMIN = 'ROLE_ADMIN', 'Admin'

class User(AbstractUser):
    email = models.EmailField(unique=True)
    roles = models.JSONField(default=list)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.roles:
            self.roles = [Role.USER]
        super().save(*args, **kwargs)

class Transfer(models.Model):
    reference_id = models.CharField(max_length=64, unique=True, db_index=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='transfers')
    source_account = models.CharField(max_length=34)
    target_account = models.CharField(max_length=34)
    amount = models.DecimalField(max_digits=19, decimal_places=4)
    currency = models.CharField(max_length=3, default='USD')
    status = models.CharField(max_length=20, default='COMPLETED')
    description = models.CharField(max_length=255, blank=True, null=True)
    idempotency_key = models.CharField(max_length=128, unique=True, null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
