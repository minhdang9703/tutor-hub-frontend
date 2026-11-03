-- =====================================================================
-- TutorHub - V1: schema khởi tạo
-- Quy ước: tiền lưu BIGINT (VNĐ, không dùng float), thời gian dùng TIMESTAMPTZ,
-- enum dùng VARCHAR + CHECK (dễ map JPA @Enumerated(EnumType.STRING)).
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS citext;      -- email không phân biệt hoa thường
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- cho exclusion constraint chống trùng lịch

-- Trigger dùng chung: tự cập nhật updated_at
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- 1. TÀI KHOẢN
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id                  BIGSERIAL PRIMARY KEY,
    email               CITEXT       NOT NULL UNIQUE,
    phone               VARCHAR(20)  UNIQUE,
    password_hash       VARCHAR(100) NOT NULL,
    full_name           VARCHAR(120) NOT NULL,
    avatar_key          VARCHAR(255),
    role                VARCHAR(10)  NOT NULL CHECK (role IN ('PARENT', 'TUTOR', 'ADMIN')),
    status              VARCHAR(25)  NOT NULL DEFAULT 'PENDING_VERIFICATION'
                        CHECK (status IN ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DELETED')),
    email_verified_at   TIMESTAMPTZ,
    phone_verified_at   TIMESTAMPTZ,
    last_login_at       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Refresh token: chỉ lưu hash, cho phép thu hồi (logout / đổi mật khẩu)
CREATE TABLE refresh_tokens (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash   VARCHAR(64)  NOT NULL UNIQUE,
    expires_at   TIMESTAMPTZ  NOT NULL,
    revoked_at   TIMESTAMPTZ,
    user_agent   VARCHAR(255),
    ip_address   VARCHAR(45),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);

-- Token xác minh email / quên mật khẩu
CREATE TABLE verification_tokens (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose      VARCHAR(20) NOT NULL CHECK (purpose IN ('VERIFY_EMAIL', 'RESET_PASSWORD', 'VERIFY_PHONE')),
    token_hash   VARCHAR(64) NOT NULL UNIQUE,
    expires_at   TIMESTAMPTZ NOT NULL,
    used_at      TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_verification_tokens_user ON verification_tokens(user_id);

-- ---------------------------------------------------------------------
-- 2. DANH MỤC
-- ---------------------------------------------------------------------
CREATE TABLE districts (
    id        SERIAL PRIMARY KEY,
    city      VARCHAR(80) NOT NULL,
    name      VARCHAR(80) NOT NULL,
    UNIQUE (city, name)
);

CREATE TABLE subjects (
    id        SERIAL PRIMARY KEY,
    name      VARCHAR(80)  NOT NULL UNIQUE,
    slug      VARCHAR(100) NOT NULL UNIQUE,
    active    BOOLEAN      NOT NULL DEFAULT TRUE
);

-- ---------------------------------------------------------------------
-- 3. HỒ SƠ GIA SƯ
-- ---------------------------------------------------------------------
CREATE TABLE tutor_profiles (
    user_id              BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    headline             VARCHAR(160),
    bio                  TEXT,
    education_level      VARCHAR(20) CHECK (education_level IN
                         ('STUDENT', 'BACHELOR', 'MASTER', 'PHD', 'TEACHER')),
    school               VARCHAR(160),
    major                VARCHAR(120),
    years_experience     SMALLINT    NOT NULL DEFAULT 0 CHECK (years_experience >= 0),
    hourly_rate          BIGINT      NOT NULL CHECK (hourly_rate >= 0),   -- VNĐ / giờ
    teaching_mode        VARCHAR(10) NOT NULL DEFAULT 'BOTH'
                         CHECK (teaching_mode IN ('ONLINE', 'AT_HOME', 'BOTH')),
    district_id          INT REFERENCES districts(id),
    verification_status  VARCHAR(10) NOT NULL DEFAULT 'DRAFT'
                         CHECK (verification_status IN ('DRAFT', 'PENDING', 'VERIFIED', 'REJECTED')),
    verified_at          TIMESTAMPTZ,
    verified_by          BIGINT REFERENCES users(id),
    reject_reason        VARCHAR(500),
    rating_avg           NUMERIC(3,2) NOT NULL DEFAULT 0,
    rating_count         INT          NOT NULL DEFAULT 0,
    search_vector        TSVECTOR GENERATED ALWAYS AS (
                             to_tsvector('simple',
                                 coalesce(headline, '') || ' ' || coalesce(bio, '') || ' ' ||
                                 coalesce(school, '')   || ' ' || coalesce(major, ''))
                         ) STORED,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_tutor_profiles_updated BEFORE UPDATE ON tutor_profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_tutor_profiles_search   ON tutor_profiles USING GIN (search_vector);
CREATE INDEX idx_tutor_profiles_district ON tutor_profiles(district_id) WHERE verification_status = 'VERIFIED';
CREATE INDEX idx_tutor_profiles_rate     ON tutor_profiles(hourly_rate) WHERE verification_status = 'VERIFIED';

CREATE TABLE tutor_subjects (
    tutor_id    BIGINT   NOT NULL REFERENCES tutor_profiles(user_id) ON DELETE CASCADE,
    subject_id  INT      NOT NULL REFERENCES subjects(id),
    grade_from  SMALLINT NOT NULL CHECK (grade_from BETWEEN 1 AND 12),
    grade_to    SMALLINT NOT NULL CHECK (grade_to BETWEEN 1 AND 12),
    PRIMARY KEY (tutor_id, subject_id),
    CHECK (grade_to >= grade_from)
);
CREATE INDEX idx_tutor_subjects_subject ON tutor_subjects(subject_id);

-- Giấy tờ xác minh (CCCD, bằng cấp, thẻ sinh viên). File nằm ở MinIO/S3, DB chỉ giữ key.
CREATE TABLE tutor_documents (
    id            BIGSERIAL PRIMARY KEY,
    tutor_id      BIGINT       NOT NULL REFERENCES tutor_profiles(user_id) ON DELETE CASCADE,
    doc_type      VARCHAR(20)  NOT NULL CHECK (doc_type IN ('ID_CARD', 'DEGREE', 'STUDENT_CARD', 'CERTIFICATE')),
    storage_key   VARCHAR(255) NOT NULL,
    status        VARCHAR(10)  NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    reviewed_by   BIGINT REFERENCES users(id),
    reviewed_at   TIMESTAMPTZ,
    reject_reason VARCHAR(500),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_tutor_documents_tutor ON tutor_documents(tutor_id);

-- Lịch rảnh lặp lại theo tuần (1 = Thứ Hai ... 7 = Chủ Nhật, theo ISO)
CREATE TABLE tutor_availability (
    id           BIGSERIAL PRIMARY KEY,
    tutor_id     BIGINT   NOT NULL REFERENCES tutor_profiles(user_id) ON DELETE CASCADE,
    day_of_week  SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    start_time   TIME     NOT NULL,
    end_time     TIME     NOT NULL,
    CHECK (end_time > start_time)
);
CREATE INDEX idx_tutor_availability_tutor ON tutor_availability(tutor_id, day_of_week);

-- ---------------------------------------------------------------------
-- 4. PHỤ HUYNH VÀ CON
-- ---------------------------------------------------------------------
CREATE TABLE parent_profiles (
    user_id      BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    address      VARCHAR(255),
    district_id  INT REFERENCES districts(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_parent_profiles_updated BEFORE UPDATE ON parent_profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE children (
    id          BIGSERIAL PRIMARY KEY,
    parent_id   BIGINT      NOT NULL REFERENCES parent_profiles(user_id) ON DELETE CASCADE,
    name        VARCHAR(80) NOT NULL,
    grade       SMALLINT    NOT NULL CHECK (grade BETWEEN 1 AND 12),
    school      VARCHAR(160),
    notes       VARCHAR(500),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_children_parent ON children(parent_id);

-- ---------------------------------------------------------------------
-- 5. YÊU CẦU TÌM GIA SƯ VÀ ỨNG TUYỂN
-- ---------------------------------------------------------------------
CREATE TABLE tutor_requests (
    id             BIGSERIAL PRIMARY KEY,
    parent_id      BIGINT      NOT NULL REFERENCES parent_profiles(user_id),
    child_id       BIGINT      REFERENCES children(id) ON DELETE SET NULL,
    subject_id     INT         NOT NULL REFERENCES subjects(id),
    grade          SMALLINT    NOT NULL CHECK (grade BETWEEN 1 AND 12),
    district_id    INT         REFERENCES districts(id),
    mode           VARCHAR(10) NOT NULL CHECK (mode IN ('ONLINE', 'AT_HOME')),
    budget_min     BIGINT      CHECK (budget_min >= 0),          -- VNĐ / giờ
    budget_max     BIGINT,
    sessions_per_week SMALLINT CHECK (sessions_per_week BETWEEN 1 AND 14),
    schedule_note  VARCHAR(500),
    description    TEXT,
    status         VARCHAR(10) NOT NULL DEFAULT 'OPEN'
                   CHECK (status IN ('OPEN', 'MATCHED', 'CLOSED', 'EXPIRED')),
    expires_at     TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (budget_max IS NULL OR budget_min IS NULL OR budget_max >= budget_min)
);
CREATE TRIGGER trg_tutor_requests_updated BEFORE UPDATE ON tutor_requests
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_requests_open_search ON tutor_requests(subject_id, district_id, created_at DESC)
    WHERE status = 'OPEN';
CREATE INDEX idx_requests_parent ON tutor_requests(parent_id, created_at DESC);

CREATE TABLE applications (
    id             BIGSERIAL PRIMARY KEY,
    request_id     BIGINT      NOT NULL REFERENCES tutor_requests(id) ON DELETE CASCADE,
    tutor_id       BIGINT      NOT NULL REFERENCES tutor_profiles(user_id),
    message        VARCHAR(1000),
    proposed_rate  BIGINT      NOT NULL CHECK (proposed_rate >= 0),
    status         VARCHAR(10) NOT NULL DEFAULT 'PENDING'
                   CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN')),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (request_id, tutor_id)            -- mỗi gia sư chỉ ứng tuyển 1 lần / yêu cầu
);
CREATE TRIGGER trg_applications_updated BEFORE UPDATE ON applications
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_applications_tutor ON applications(tutor_id, created_at DESC);
-- Mỗi yêu cầu chỉ có tối đa 1 ứng tuyển được chấp nhận
CREATE UNIQUE INDEX uq_applications_one_accepted ON applications(request_id) WHERE status = 'ACCEPTED';

-- ---------------------------------------------------------------------
-- 6. ĐẶT LỊCH HỌC
-- ---------------------------------------------------------------------
CREATE TABLE bookings (
    id              BIGSERIAL PRIMARY KEY,
    tutor_id        BIGINT      NOT NULL REFERENCES tutor_profiles(user_id),
    parent_id       BIGINT      NOT NULL REFERENCES parent_profiles(user_id),
    child_id        BIGINT      REFERENCES children(id) ON DELETE SET NULL,
    subject_id      INT         NOT NULL REFERENCES subjects(id),
    application_id  BIGINT      REFERENCES applications(id),
    start_at        TIMESTAMPTZ NOT NULL,
    end_at          TIMESTAMPTZ NOT NULL,
    mode            VARCHAR(10) NOT NULL CHECK (mode IN ('ONLINE', 'AT_HOME')),
    location        VARCHAR(255),
    meeting_url     VARCHAR(255),
    price           BIGINT      NOT NULL CHECK (price >= 0),          -- VNĐ cho buổi này
    is_trial        BOOLEAN     NOT NULL DEFAULT FALSE,
    status          VARCHAR(10) NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW')),
    cancelled_by    BIGINT REFERENCES users(id),
    cancel_reason   VARCHAR(500),
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_at > start_at),
    -- DB tự chặn trùng lịch của cùng 1 gia sư, kể cả khi 2 request đến cùng lúc.
    -- Buổi đã huỷ / vắng mặt không chiếm chỗ.
    CONSTRAINT ex_bookings_no_overlap EXCLUDE USING gist (
        tutor_id WITH =,
        tstzrange(start_at, end_at, '[)') WITH &&
    ) WHERE (status IN ('PENDING', 'CONFIRMED', 'COMPLETED'))
);
CREATE TRIGGER trg_bookings_updated BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_bookings_tutor  ON bookings(tutor_id, start_at);
CREATE INDEX idx_bookings_parent ON bookings(parent_id, start_at);
CREATE INDEX idx_bookings_status ON bookings(status, start_at);

-- ---------------------------------------------------------------------
-- 7. ĐÁNH GIÁ
-- ---------------------------------------------------------------------
CREATE TABLE reviews (
    id          BIGSERIAL PRIMARY KEY,
    booking_id  BIGINT      NOT NULL UNIQUE REFERENCES bookings(id),   -- 1 buổi học = tối đa 1 đánh giá
    parent_id   BIGINT      NOT NULL REFERENCES parent_profiles(user_id),
    tutor_id    BIGINT      NOT NULL REFERENCES tutor_profiles(user_id),
    rating      SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment     VARCHAR(2000),
    reply       VARCHAR(1000),                                         -- gia sư phản hồi
    replied_at  TIMESTAMPTZ,
    visible     BOOLEAN     NOT NULL DEFAULT TRUE,                     -- admin ẩn nếu vi phạm
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reviews_tutor ON reviews(tutor_id, created_at DESC) WHERE visible;
-- Lưu ý: service chỉ cho tạo review khi bookings.status = 'COMPLETED'
-- và bookings.parent_id = người gọi; sau đó cập nhật rating_avg / rating_count.

-- ---------------------------------------------------------------------
-- 8. CHAT VÀ THÔNG BÁO
-- ---------------------------------------------------------------------
CREATE TABLE conversations (
    id               BIGSERIAL PRIMARY KEY,
    parent_id        BIGINT      NOT NULL REFERENCES parent_profiles(user_id),
    tutor_id         BIGINT      NOT NULL REFERENCES tutor_profiles(user_id),
    request_id       BIGINT      REFERENCES tutor_requests(id) ON DELETE SET NULL,
    last_message_at  TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (parent_id, tutor_id)
);
CREATE INDEX idx_conversations_tutor ON conversations(tutor_id, last_message_at DESC);
CREATE INDEX idx_conversations_parent ON conversations(parent_id, last_message_at DESC);

CREATE TABLE messages (
    id               BIGSERIAL PRIMARY KEY,
    conversation_id  BIGINT      NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id        BIGINT      NOT NULL REFERENCES users(id),
    content          VARCHAR(4000) NOT NULL,
    read_at          TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, id DESC);

CREATE TABLE notifications (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        VARCHAR(40)  NOT NULL,        -- vd: APPLICATION_RECEIVED, BOOKING_CONFIRMED
    title       VARCHAR(160) NOT NULL,
    body        VARCHAR(500),
    data        JSONB,                        -- vd: {"bookingId": 12}
    read_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE read_at IS NULL;

-- ---------------------------------------------------------------------
-- 9. KHIẾU NẠI VÀ AUDIT
-- ---------------------------------------------------------------------
CREATE TABLE reports (
    id            BIGSERIAL PRIMARY KEY,
    reporter_id   BIGINT       NOT NULL REFERENCES users(id),
    target_type   VARCHAR(15)  NOT NULL CHECK (target_type IN ('USER', 'REVIEW', 'BOOKING', 'MESSAGE')),
    target_id     BIGINT       NOT NULL,
    reason        VARCHAR(40)  NOT NULL,
    description   VARCHAR(2000),
    status        VARCHAR(10)  NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED', 'DISMISSED')),
    resolved_by   BIGINT REFERENCES users(id),
    resolution    VARCHAR(1000),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    resolved_at   TIMESTAMPTZ
);
CREATE INDEX idx_reports_status ON reports(status, created_at DESC);

CREATE TABLE audit_logs (
    id           BIGSERIAL PRIMARY KEY,
    actor_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
    action       VARCHAR(60)  NOT NULL,       -- vd: TUTOR_VERIFIED, BOOKING_CANCELLED
    entity_type  VARCHAR(40)  NOT NULL,
    entity_id    BIGINT,
    details      JSONB,
    ip_address   VARCHAR(45),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_actor  ON audit_logs(actor_id, created_at DESC);
