const pdu    = require("modbus-pdu");
const events = require("events");

class BaseTransport {
	constructor (stream) {
		this.events   = new events();
		this.stream   = stream;
		this.listen();
	}
	write (data) {
		this.events.emit("outgoing-data", data);
		this.stream.write(data);
	}
	listen () {
		this.stream.on("data", (data) => {
			this.events.emit("incoming-data", data);

			let req = this.unwrap(data);

			if (typeof req.callback == "function") {
				try {
					req.response = pdu.Response(req.pdu);

					if (typeof req.response.exception != "undefined") {
						req.callback(new Error(req.response.exception), req);
					} else {
						req.callback(null, req);
					}

					delete req.callback;
				} catch (err) {
					this.events.emit("error", err);
				}
			} else {
				try {
					req.request = pdu.Request(req.pdu);

					let event_name = req.request.code.replace(/(.)([A-Z])/g, (m, b, l) => (b + "-" + l)).toLowerCase();

					this.events.emit("request", event_name, req, (err, ...data) => {
						if (err instanceof Error) {
							return this.write(this.wrap(pdu[req.request.code].Exception.build(err.code || +err.message)));
						}

						this.write(this.wrap(pdu[req.request.code].Response.build(...data), req));
					});
				} catch (err) {
					this.events.emit("error", err);
				}
			}
		});
	}
}

module.exports = BaseTransport;