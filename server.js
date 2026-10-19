const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ==========================================
// 1. KẾT NỐI VÀ KHỞI TẠO DATABASE
// ==========================================
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
        console.error("❌ Lỗi kết nối SQLite:", err.message);
    } else {
        console.log("✅ Đã kết nối với SQLite Database.");
    }
});

// Khởi tạo các bảng dữ liệu
db.serialize(() => {
    // 1. Bảng Người dùng (Sinh viên)
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        full_name TEXT NOT NULL,
        student_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 2. Bảng Phòng học
    db.run(`CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        image TEXT,
        location TEXT,
        capacity INTEGER,
        description TEXT,
        status TEXT DEFAULT 'available'
    )`);

    // 3. Bảng Đặt phòng
    db.run(`CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        book_date TEXT NOT NULL,
        time_slot TEXT NOT NULL,
        status TEXT DEFAULT 'booked',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES rooms(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // Thêm dữ liệu tài khoản mẫu
    db.get("SELECT COUNT(*) AS count FROM users", (err, row) => {
        if (!err && row && row.count === 0) {
            const insertUser = db.prepare("INSERT INTO users (username, password, full_name, student_id) VALUES (?, ?, ?, ?)");
            insertUser.run('sv001', '123456', 'Nguyễn Văn An', 'SV2021001');
            insertUser.run('sv002', '123456', 'Trần Thị Bình', 'SV2021002');
            insertUser.finalize();
            console.log("👤 Đã khởi tạo 2 tài khoản sinh viên mẫu: sv001, sv002 (mật khẩu: 123456)");
        }
    });

    // Thêm dữ liệu phòng học mẫu với link ảnh thật (Unsplash)
    db.get("SELECT COUNT(*) AS count FROM rooms", (err, row) => {
        if (!err && row && row.count === 0) {
            const insertRoom = db.prepare("INSERT INTO rooms VALUES (?, ?, ?, ?, ?, ?, ?)");
            
            // 1. Computer Lab (Phòng máy tính)
            insertRoom.run(
                '101',
                'Phòng Lab Máy Tính AI & Data',
                'https://images.unsplash.com/photo-1562774053-701939374585?w=800&auto=format&fit=crop&q=80',
                'Tầng 1',
                45,
                'Trang bị 45 máy workstation cấu hình cao, GPU RTX 4080, máy chiếu 4K',
                'available'
            );
            
            // 2. Tech Lab / Network Lab (Phòng thực hành mạng)
            insertRoom.run(
                '102',
                'Phòng Thực Hành Mạng & An Toàn TT',
                'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80',
                'Tầng 1',
                35,
                'Bao gồm hệ thống Router/Switch Cisco thực hành và server nội bộ',
                'available'
            );
            
            // 3. Meeting Room (Phòng họp nhóm)
            insertRoom.run(
                '201',
                'Phòng Họp Nhóm Thảo Luận',
                'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&auto=format&fit=crop&q=80',
                'Tầng 2',
                15,
                'Smart TV 65 inch, bảng flipchart, cách âm tiêu chuẩn cao',
                'available'
            );
            
            // 4. Conference / Auditorium (Hội trường lớn)
            insertRoom.run(
                '202',
                'Hội Trường Chuyên Đề & Workshop',
                'https://images.unsplash.com/photo-1517502884422-41eaead166d4?w=800&auto=format&fit=crop&q=80',
                'Tầng 2',
                100,
                'Âm thanh vòm, 2 màn chiếu lớn, micro hội nghị không dây',
                'available'
            );
            
            // 5. Library / Study Space (Không gian tự học)
            insertRoom.run(
                '301',
                'Không Gian Tự Học Thư Viện',
                'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=800&auto=format&fit=crop&q=80',
                'Tầng 3',
                30,
                'Không gian yên tĩnh, ổ cắm từng bàn làm việc, ánh sáng bảo vệ mắt',
                'available'
            );

            // 6. Smart Classroom (Phòng học thông minh)
            insertRoom.run(
                '302',
                'Phòng Học Đa Năng Thông Minh',
                'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800&auto=format&fit=crop&q=80',
                'Tầng 3',
                50,
                'Bàn ghế module linh hoạt cho thảo luận nhóm, màn hình tương tác thông minh',
                'available'
            );

            insertRoom.finalize();
            console.log("🏫 Đã khởi tạo 6 phòng học/lab mẫu với ảnh thật chất lượng cao.");
        }
    });
});

// ==========================================
// 2. CÁC API AUTH (ĐĂNG NHẬP / ĐĂNG KÝ)
// ==========================================

// API Đăng ký tài khoản sinh viên mới
app.post('/api/register', (req, res) => {
    const { username, password, full_name, student_id } = req.body;

    if (!username || !password || !full_name) {
        return res.status(400).json({ success: false, error: "Vui lòng nhập đầy đủ thông tin bắt buộc!" });
    }

    // Kiểm tra tên đăng nhập đã tồn tại chưa
    db.get("SELECT id FROM users WHERE username = ?", [username], (err, row) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        if (row) {
            return res.status(400).json({ success: false, error: "Tên đăng nhập đã tồn tại, vui lòng chọn tên khác!" });
        }

        const insert = "INSERT INTO users (username, password, full_name, student_id) VALUES (?, ?, ?, ?)";
        db.run(insert, [username, password, full_name, student_id || ''], function (insertErr) {
            if (insertErr) return res.status(500).json({ success: false, error: insertErr.message });

            res.status(201).json({
                success: true,
                message: "Đăng ký tài khoản thành công!",
                user: {
                    id: this.lastID,
                    username,
                    full_name,
                    student_id: student_id || ''
                }
            });
        });
    });
});

// API Đăng nhập
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, error: "Vui lòng điền tên đăng nhập và mật khẩu!" });
    }

    db.get(
        "SELECT id, username, full_name, student_id FROM users WHERE username = ? AND password = ?",
        [username, password],
        (err, user) => {
            if (err) return res.status(500).json({ success: false, error: err.message });
            if (!user) {
                return res.status(401).json({ success: false, error: "Sai tên đăng nhập hoặc mật khẩu!" });
            }

            res.json({
                success: true,
                message: "Đăng nhập thành công!",
                user: user
            });
        }
    );
});

// ==========================================
// 3. API PHÒNG HỌC & TÌM KIẾM
// ==========================================

// API Lấy danh sách phòng (kèm bộ lọc vị trí, sức chứa, từ khóa)
app.get('/api/rooms', (req, res) => {
    const { location, capacity, search } = req.query;
    let query = "SELECT * FROM rooms WHERE 1=1";
    let params = [];

    if (location && location !== 'Tất cả') {
        query += " AND location = ?";
        params.push(location);
    }
    if (capacity && Number(capacity) > 0) {
        query += " AND capacity >= ?";
        params.push(Number(capacity));
    }
    if (search && search.trim() !== '') {
        query += " AND (name LIKE ? OR description LIKE ?)";
        params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, data: rows });
    });
});

// API Lấy danh sách khung giờ đã bị đặt của 1 phòng trong 1 ngày cụ thể
app.get('/api/rooms/:id/booked-slots', (req, res) => {
    const roomId = req.params.id;
    const { date } = req.query;

    if (!date) {
        return res.status(400).json({ success: false, error: "Thiếu ngày cần kiểm tra!" });
    }

    const query = "SELECT time_slot FROM bookings WHERE room_id = ? AND book_date = ? AND status != 'cancelled'";
    db.all(query, [roomId, date], (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        const bookedSlots = rows.map(r => r.time_slot);
        res.json({ success: true, booked_slots: bookedSlots });
    });
});

// ==========================================
// 4. API LỊCH SỬ ĐẶT PHÒNG & HỦY PHÒNG
// ==========================================

// API Lấy lịch sử đặt phòng của 1 sinh viên
app.get('/api/bookings/:user_id', (req, res) => {
    const userId = req.params.user_id;
    const query = `
        SELECT 
            b.id,
            b.room_id,
            b.book_date,
            b.time_slot,
            b.status,
            b.created_at,
            r.name AS room_name,
            r.location,
            r.capacity,
            r.image
        FROM bookings b
        JOIN rooms r ON b.room_id = r.id
        WHERE b.user_id = ?
        ORDER BY b.id DESC
    `;

    db.all(query, [userId], (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, data: rows });
    });
});

// API Hủy đặt phòng
app.post('/api/cancel-booking', (req, res) => {
    const { booking_id, user_id } = req.body;

    if (!booking_id || !user_id) {
        return res.status(400).json({ success: false, error: "Thiếu thông tin hủy phòng!" });
    }

    const query = "UPDATE bookings SET status = 'cancelled' WHERE id = ? AND user_id = ?";
    db.run(query, [booking_id, user_id], function (err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        if (this.changes === 0) {
            return res.status(404).json({ success: false, error: "Không tìm thấy lịch đặt hoặc bạn không có quyền hủy!" });
        }
        res.json({ success: true, message: "Hủy đặt phòng thành công!" });
    });
});

// =========================================================================
// 5. CORE LOGIC: ĐẶT PHÒNG VỚI TRANSACTION ĐỘC QUYỀN (RACE CONDITION FIX)
// =========================================================================
app.post('/api/book', (req, res) => {
    const { room_id, user_id, book_date, time_slot } = req.body;

    // Kiểm tra dữ liệu đầu vào
    if (!room_id || !user_id || !book_date || !time_slot) {
        return res.status(400).json({ success: false, error: "Thiếu thông tin đặt phòng!" });
    }

    // Sử dụng db.serialize để đảm bảo các bước SQLite chạy tuần tự chặt chẽ
    db.serialize(() => {
        // BƯỚC 1: Bắt đầu Giao dịch Độc quyền (Exclusive Lock)
        // Khi câu lệnh này chạy, SQLite lập tức khóa ghi Database,
        // các request đến sau phải đợi hoặc bị chặn cho đến khi transaction kết thúc.
        db.run("BEGIN EXCLUSIVE TRANSACTION", (beginErr) => {
            if (beginErr) {
                console.error("Lock error:", beginErr.message);
                return res.status(500).json({ success: false, error: "Hệ thống bận, vui lòng thử lại sau vài giây!" });
            }

            // BƯỚC 2: Kiểm tra phòng trong ngày & giờ đó đã được ai đặt chưa
            const checkQuery = `
                SELECT id 
                FROM bookings 
                WHERE room_id = ? AND book_date = ? AND time_slot = ? AND status != 'cancelled'
            `;

            db.get(checkQuery, [room_id, book_date, time_slot], (checkErr, existingBooking) => {
                if (checkErr) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ success: false, error: checkErr.message });
                }

                // XỬ LÝ CONFLICT: Nếu đã có người đặt trước (Dù chỉ trước 1 phần nghìn giây)
                if (existingBooking) {
                    // Hủy giao dịch (Rollback) giải phóng khóa Database
                    db.run("ROLLBACK");
                    // Trả về đúng HTTP STATUS 409 (Conflict) theo yêu cầu đề bài
                    return res.status(409).json({
                        success: false,
                        error: "Phòng vừa bị đặt, vui lòng chọn phòng khác!"
                    });
                }

                // BƯỚC 3: Nếu phòng còn trống, tiến hành ghi dữ liệu
                const insertQuery = `
                    INSERT INTO bookings (room_id, user_id, book_date, time_slot, status) 
                    VALUES (?, ?, ?, ?, 'booked')
                `;

                db.run(insertQuery, [room_id, user_id, book_date, time_slot], function (insertErr) {
                    if (insertErr) {
                        db.run("ROLLBACK");
                        return res.status(500).json({ success: false, error: "Lỗi ghi dữ liệu vào hệ thống." });
                    }

                    const newBookingId = this.lastID;

                    // BƯỚC 4: Cam kết dữ liệu và Mở khóa Database (Commit)
                    db.run("COMMIT", (commitErr) => {
                        if (commitErr) {
                            db.run("ROLLBACK");
                            return res.status(500).json({ success: false, error: "Lỗi cam kết giao dịch." });
                        }

                        console.log(`[Booked Success] Room: ${room_id} | User: ${user_id} | Date: ${book_date} | Slot: ${time_slot}`);
                        return res.status(201).json({
                            success: true,
                            message: "Đặt phòng thành công!",
                            booking_id: newBookingId
                        });
                    });
                });
            });
        });
    });
});

// ==========================================
// 6. KHỞI ĐỘNG SERVER
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server Backend đang chạy tại port: ${PORT}`);
});