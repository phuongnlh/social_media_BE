const emailTemplateModel = require("../../models/Admin/emailTemplate.model");

// 🔹 Lấy tất cả template
const getAllTemplates = async (req, res) => {
  const templates = await emailTemplateModel.find().sort({ createdAt: -1 });
  return res.status(200).json(templates);
};

// 🔹 Lấy 1 template theo loại
const getTemplate = async (req, res) => {
  const template = await emailTemplateModel.findOne({ type: req.params.type });
  if (!template) return res.status(404).json({ message: "Template not found" });
  return res.status(200).json(template);
};

// 🔹 Cập nhật hoặc tạo mới template
const saveTemplate = async (req, res) => {
  const { type, name, subject, html, text } = req.body;

  const existing = await emailTemplateModel.findOne({ type });
  let template;
  if (existing) {
    existing.subject = subject;
    existing.html = html;
    existing.text = text;
    existing.updatedBy = req.user._id;
    template = await existing.save();
  } else {
    template = await emailTemplateModel.create({
      type,
      name,
      subject,
      html,
      text,
      updatedBy: req.user._id,
    });
  }

  res.status(200).json({ message: "Template saved", template });
};

module.exports = {
  getAllTemplates,
  getTemplate,
  saveTemplate,
};