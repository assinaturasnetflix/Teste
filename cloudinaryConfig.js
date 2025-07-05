// backend/cloudinaryConfig.js

const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// 1. Configuração do Cloudinary
// Aqui, o SDK do Cloudinary é configurado com as credenciais fornecidas
// no nosso arquivo .env. Isso autoriza nossa aplicação a se comunicar
// com nossa conta do Cloudinary.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 2. Configuração do Storage com Multer
// Em vez de salvar o arquivo no disco do servidor, nós o enviamos
// direto para o Cloudinary. O `CloudinaryStorage` cuida disso.
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'ecommerce-clothing-app', // Nome da pasta no Cloudinary para organizar os arquivos
    format: async (req, file) => 'png', // Garante que as imagens sejam salvas como PNG (ou outro formato de sua escolha)
    public_id: (req, file) => `${file.fieldname}-${Date.now()}`, // Cria um nome de arquivo único
  },
});

// 3. Filtro de Arquivos
// Esta função garante que apenas arquivos de imagem sejam enviados.
// Se um arquivo de outro tipo for enviado, um erro será gerado.
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true); // Aceita o arquivo
    } else {
        cb(new Error('Tipo de arquivo não suportado. Apenas JPEG, PNG, JPG são permitidos.'), false); // Rejeita o arquivo
    }
};


// 4. Criação do Middleware de Upload
// Criamos a instância do multer, passando o storage configurado e o filtro de arquivos.
// O método `.single('image')` significa que esperamos um único arquivo no campo 'image' do formulário.
// Você pode usar `.array('images', 5)` para múltiplas imagens. Para nosso produto, uma imagem é suficiente por enquanto.
const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 1024 * 1024 * 5 // Limita o tamanho do arquivo a 5MB
    }
});

// Exportamos o 'upload' para que possamos usá-lo como middleware em nossas rotas.
module.exports = upload;