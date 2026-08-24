from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import User, Transfer

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        data['user'] = {
            'id': self.user.id,
            'username': self.user.username,
            'email': self.user.email,
            'roles': self.user.roles,
        }
        data['expiresInMs'] = 900000  # 15 mins
        data['tokenType'] = 'Bearer'
        return data

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'roles', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password', 'roles', 'is_active']

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)

class TransferSerializer(serializers.ModelSerializer):
    sourceAccount = serializers.CharField(source='source_account')
    targetAccount = serializers.CharField(source='target_account')
    referenceId = serializers.CharField(source='reference_id', read_only=True)
    idempotencyKey = serializers.CharField(source='idempotency_key', read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = Transfer
        fields = ['id', 'referenceId', 'sourceAccount', 'targetAccount', 'amount', 'currency', 'status', 'description', 'idempotencyKey', 'createdAt']
        read_only_fields = ['id', 'referenceId', 'status', 'idempotencyKey', 'createdAt']
