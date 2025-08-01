/**
 * Middleware para capturar todos os erros não tratados da aplicação.
 */
module.exports = (err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        message: err.message || 'Erro interno no servidor',
    });
};
