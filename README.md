# Notify PDF Host + 생년월일 검증

`doc/` 폴더에 PDF를 두고, 허용된 사용자(이름 + 생년월일)만 열람하도록 구성한 간단한 서버입니다.

## 실행

```bash
node server.js
```

기본 주소: `http://localhost:3000`

## 환경변수

- `ALLOWED_PERSON_NAME` (기본값: `홍길동`)
- `ALLOWED_PERSON_BIRTHDATE` (기본값: `1990-01-01`)
- `TOKEN_SECRET` (기본값: `change-this-secret`)
- `TOKEN_TTL_SECONDS` (기본값: `300`)

## 동작

1. `/` 접속 후 이름 + 생년월일 + PDF 파일명 입력
2. `/api/verify-dob`에서 검증
3. 성공 시 만료시간 포함 토큰 기반 `pdfUrl` 반환
4. `/pdf/<file>?token=...` 에서 토큰 유효성 검증 후 PDF 스트리밍

## 함수 위치

- 생년월일 검증 함수: `functions/verifyDob.js`
