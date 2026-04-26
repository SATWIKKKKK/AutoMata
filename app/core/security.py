from datetime import datetime, timedelta, timezone
from cryptography.fernet import Fernet
from typing import Any, Union, Optional
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from app.core.config import settings

security = HTTPBearer()
fernet = Fernet(settings.FERNET_KEY)

class TokenPayload(BaseModel):
    sub: Optional[str] = None
    workspace_id: Optional[str] = None

def create_access_token(subject: Union[str, Any], workspace_id: str, expires_delta: timedelta = None) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"exp": expire, "sub": str(subject), "workspace_id": workspace_id}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> TokenPayload:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        token_data = TokenPayload(**payload)
        if token_data.sub is None or token_data.workspace_id is None:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        return token_data
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

def encrypt_token(plain_text: str) -> str:
    return fernet.encrypt(plain_text.encode()).decode()

def decrypt_token(cipher_text: str) -> str:
    return fernet.decrypt(cipher_text.encode()).decode()
