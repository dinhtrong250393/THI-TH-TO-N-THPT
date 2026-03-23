import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export const parseExamFromText = async (text: string) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Hãy phân tích nội dung đề thi sau và chuyển thành cấu trúc JSON. 
    Đảm bảo các công thức toán học được giữ nguyên định dạng LaTeX (ví dụ: $x^2$).
    Nếu câu hỏi có nhắc đến hình ảnh, hãy để trống trường imageUrl.
    
    Nội dung:
    ${text}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                text: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctAnswer: { type: Type.STRING, description: "Đáp án đúng (A, B, C, hoặc D)" }
              },
              required: ["id", "text", "options", "correctAnswer"]
            }
          }
        },
        required: ["title", "questions"]
      }
    }
  });

  return JSON.parse(response.text);
};

export const parseStudentList = async (text: string) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Hãy phân tích danh sách học sinh sau và chuyển thành cấu trúc JSON.
    Mỗi học sinh cần có: displayName (tên), email, password (mật khẩu).
    Nếu có link hình ảnh, hãy thêm vào trường photoUrl.
    
    Danh sách:
    ${text}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            displayName: { type: Type.STRING },
            email: { type: Type.STRING },
            password: { type: Type.STRING },
            photoUrl: { type: Type.STRING }
          },
          required: ["displayName", "email", "password"]
        }
      }
    }
  });

  return JSON.parse(response.text);
};
