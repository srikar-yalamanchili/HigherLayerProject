"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = __importDefault(require("express"));
var app = express_1.default();
var PORT = process.env.port || 8080;
var server = app.listen(PORT);
var io = require('socket.io')(server, {
    cors: {
        origin: "http://localhost:5000",
        methods: ["GET", "POST"],
        credentials: true
    }
});
io.on('connection', function (socket) {
    console.log('A new user has connected');
    socket.on('disconnect', function () {
        console.log('A user has disconnected');
    });
});
var cors = require('cors');
var auctionDuaration = 60000;
var counter = 1;
var clients = [];
var auctionObjects = {};
app.use(cors({
    origin: 'http://localhost:5000',
    credentials: true,
}));
app.use(express_1.default.json());
app.get('/', function (req, res) {
    res.status(200).send('Hello world');
});
app.post('/userId', function (req, res) {
    var userId = req.body.userId;
    var client = clients.filter(function (client) { return client.id === userId; });
    res.status(200).send(JSON.stringify({ success: client.length > 0 }));
});
app.get('/getAllAuctionItems', function (req, res) {
    res.status(200).send(JSON.stringify(auctionObjects));
});
app.post('/register', function (req, res) {
    console.log(" In server");
    var clientName = req.body.clientName;
    var email = req.body.email;
    var password = req.body.password;
    debugger;
    if (!clientName || !email || !password)
        return res.status(400).send(JSON.stringify({ success: false,
            successMessage: "",
            errorMessage: " Please provide all the details for registration." }));
    if (clients.findIndex(function (client) { return client.email === email; }) !== -1)
        return res.status(400).send(JSON.stringify({ success: false,
            successMessage: "",
            errorMessage: " Email already registered. " }));
    clients.push({ name: clientName, email: email, password: password, id: counter++ });
    console.log("Registered " + clientName + " successfully.");
    res.status(200).send(JSON.stringify({ success: true,
        successMessage: "Successfully registered. ",
        errorMessage: " " }));
});
app.post('/deRegister', function (req, res) {
    var clientId = req.body.id;
    var clientIndex = clients.findIndex(function (client) { return client.id == clientId; });
    if (clientIndex === -1) {
        return res.status(404).send(JSON.stringify({ success: false,
            successMessage: "",
            errorMessage: " An error occurred. " }));
    }
    var itemFound = false;
    Object.keys(auctionObjects).map(function (key) {
        var item = auctionObjects[parseInt(key)];
        if (item.bidStatus === 'Active' && (item.sellerId === clientId || item.bidderId === clientId)) {
            itemFound = true;
        }
    });
    if (itemFound) {
        return res.status(400).send(JSON.stringify({ success: false,
            successMessage: "",
            errorMessage: "Cannot de-regisiter if you have an active item in auction " }));
    }
    clients.splice(clientIndex, 1);
    return res.status(200).send(JSON.stringify({ success: true,
        successMessage: "Successfully de-registered. ",
        errorMessage: "" }));
});
app.post('/login', function (req, res) {
    var email = req.body.email;
    var password = req.body.password;
    var client = clients.find(function (client) { return client.email == email; });
    if (!client || client.password !== password) {
        return res.status(404).send(JSON.stringify({ email: null, id: null, name: null }));
    }
    return res.status(200).send(JSON.stringify({ email: client.email, id: client.id, name: client.name }));
});
app.post('/offerSaleItem', function (req, res) {
    debugger;
    var name = req.body.itemName;
    var price = req.body.price;
    var clientId = req.body.id;
    var description = req.body.description;
    if (!name || (!price && price !== 0) || !description) {
        return res.status(400).send(JSON.stringify({ success: false, errorMessage: " Please give an item name" }));
    }
    var id = Object.keys(auctionObjects).length + 1;
    var startTime = Date.now();
    var endTime = startTime + auctionDuaration;
    var auctionItem = { id: id, name: name, currentHighestBid: 0, sellerId: clientId, sellerName: clients.find(function (client) { return client.id === clientId; }).name, bidderId: '', bidderName: '', startTime: startTime, endTime: endTime, price: price, bidStatus: "Active", description: description, auctionDuaration: auctionDuaration, timeLeft: auctionDuaration / 1000 };
    auctionObjects[id] = auctionItem;
    var interval = setInterval(function () {
        if (auctionObjects[id].currentHighestBid > 0) {
            clearInterval(interval);
            auctionObjects[id]['bidStatus'] = "Inactive";
            var auctionItem_1 = auctionObjects[id];
            io.emit('updateAuctionItems', { message: "This item " + id + " has been sold to " + auctionItem_1.bidderName + ". ", auctionItem: auctionItem_1 });
            return;
        }
        auctionObjects[id]['endTime'] = Date.now() + auctionDuaration;
        var auctionItem = auctionObjects[id];
        io.emit('updateAuctionItems', { message: "This item " + id + " is still in auction.", auctionItem: auctionItem });
    }, auctionDuaration, id);
    io.emit('updateAuctionItems', { message: "A new item has been added to Auction.", auctionItem: auctionItem });
    return res.status(200).send(JSON.stringify({ success: true, successMessage: " Item has been added to Auction" }));
});
app.post('/bidForItem', function (req, res) {
    debugger;
    var itemId = req.body.itemId;
    var bidAmount = req.body.bidPrice;
    var clientId = req.body.clientId;
    var clientIndex = clients.findIndex(function (client) { return client.id == clientId; });
    if (clientIndex === -1)
        return res.status(400).send(" An error occurred. ");
    if (!itemId || (!bidAmount && bidAmount !== 0))
        return res.status(400).send((JSON.stringify({ success: false, errorMessage: "  Please provide all the details required for bid. " })));
    var auctionItem = auctionObjects[itemId];
    if (clientId === auctionItem.sellerId) {
        return res.status(400).send(JSON.stringify({ success: false, errorMessage: " You cannot bid for your item. " }));
    }
    if (auctionItem.bidStatus !== 'Active')
        return res.status(400).send(JSON.stringify({ success: false, errorMessage: " Auction time is over. " }));
    if (bidAmount < auctionItem.price || auctionItem.currentHighestBid >= bidAmount)
        return res.status(400).send(JSON.stringify({ success: false, errorMessage: " Please bid a amount higher than the item price or current highest bid." }));
    auctionItem['currentHighestBid'] = bidAmount;
    auctionItem['bidderId'] = clientId;
    auctionItem['bidderName'] = clients[clients.findIndex(function (client) { return client.id === clientId; })].name;
    io.emit('updateAuctionItems', { message: "A new bid has been added to item :" + itemId, auctionItem: auctionItem });
    return res.status(200).send((JSON.stringify({ success: true, successMessage: " Congratulations, Bid placed successfully" })));
});
// http.listen(PORT, () => console.log(`Server started on port ${PORT}`));
