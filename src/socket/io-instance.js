// Module cung cấp khả năng truy cập vào instance Socket.IO từ bất kỳ đâu trong ứng dụng

let io;

// Lưu trữ userSocketMap để có thể truy cập từ bất kỳ đâu
let userSocketMap = new Map();
let notificationUserSocketMap = new Map();
let callUserSocketMap = new Map();

// Thiết lập instance Socket.IO để sử dụng toàn cục
const setSocketIO = (socketIO, socketMap, notificationSocketMap, callSocketMap) => {
  io = socketIO;
  if (socketMap) {
    userSocketMap = socketMap;
  }
  if (notificationSocketMap) {
    notificationUserSocketMap = notificationSocketMap;
  }
  if (callSocketMap) {
    callUserSocketMap = callSocketMap;
  }
  if (io) {
    io.notificationUserSocketMap = notificationUserSocketMap;
    io.callUserSocketMap = callUserSocketMap;
    io.userSocketMap = userSocketMap;
  }
};

// Lấy instance Socket.IO
const getSocketIO = () => {
  if (!io) {
    throw new Error("Socket.IO instance chưa được khởi tạo");
  }
  return io;
};

// Lấy bản đồ kết nối socket của người dùng
const getUserSocketMap = () => {
  return userSocketMap;
};

// Lấy bản đồ kết nối socket notification của người dùng
const getNotificationUserSocketMap = () => {
  return notificationUserSocketMap;
};

const getCallUserSocketMap = () => {
  return callUserSocketMap;
};

module.exports = {
  setSocketIO,
  getSocketIO,
  getUserSocketMap,
  getNotificationUserSocketMap,
  getCallUserSocketMap,
};
