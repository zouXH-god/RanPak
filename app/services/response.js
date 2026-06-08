function success(data = null, message = "Success") {
    return { code: 200, message, data };
}

function error(message = "Error", code = 400, data = null) {
    return { code, message, data };
}

function notFound(message = "Not Found") {
    return error(message, 404);
}

function sendSuccess(res, data = null, message = "Success") {
    return res.status(200).json(success(data, message));
}

function sendError(res, message = "Error", code = 400, data = null) {
    return res.status(code).json(error(message, code, data));
}

module.exports = {
    success,
    error,
    notFound,
    sendSuccess,
    sendError,
};
