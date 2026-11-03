-- Dữ liệu danh mục ban đầu (bổ sung thêm theo thực tế)
INSERT INTO subjects (name, slug) VALUES
 ('Toán', 'toan'), ('Vật lý', 'vat-ly'), ('Hóa học', 'hoa-hoc'), ('Sinh học', 'sinh-hoc'),
 ('Ngữ văn', 'ngu-van'), ('Tiếng Anh', 'tieng-anh'), ('Tin học', 'tin-hoc'),
 ('Lịch sử', 'lich-su'), ('Địa lý', 'dia-ly'), ('Tiếng Việt (tiểu học)', 'tieng-viet-tieu-hoc');

INSERT INTO districts (city, name) VALUES
 ('TP. Hồ Chí Minh', 'Quận 1'), ('TP. Hồ Chí Minh', 'Quận 3'), ('TP. Hồ Chí Minh', 'Quận 7'),
 ('TP. Hồ Chí Minh', 'Quận Bình Thạnh'), ('TP. Hồ Chí Minh', 'Quận Gò Vấp'),
 ('TP. Hồ Chí Minh', 'TP. Thủ Đức'), ('TP. Hồ Chí Minh', 'Quận Tân Bình'),
 ('Long An', 'TP. Tân An'), ('Long An', 'Huyện Bến Lức');
-- Tài khoản ADMIN đầu tiên: tạo bằng ApplicationRunner (băm mật khẩu bằng BCrypt), không hard-code ở đây.
