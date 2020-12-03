import express from "express";

var app = express();
var PORT = 5000;
var server = app.listen(PORT);
var io = require('socket.io')(server , {
    cors: {
      origin: "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true
    }
  });

io.on('connection', function(socket : any) {
    console.log('A new user has connected');

 
    socket.on('disconnect', function () {
       console.log('A user has disconnected');
    });
 });

const cors = require('cors');


let auctionDuaration = 60000;
let counter = 1;

interface AuctionObject{
    [index : number] : AuctionItem
}

interface AuctionItem {
    id : number
    name : string
    currentHighestBid : number
    bidderId : String
    bidderName : String
    sellerId : String
    sellerName : String
    startTime : number
    endTime : number
    price : number
    description : String
    bidStatus : String
    auctionDuaration : number
    timeLeft : number
}



interface Client {
    name : string
    email : string
    password : string
    id: number
}


let clients : Array<Client> = [];
let auctionObjects = {} as AuctionObject


app.use(
    cors({
      origin: 'http://localhost:3000',
      credentials: true,
    })
 );
app.use(express.json());





app.get('/', function(req, res) {
    res.status(200).send('Hello world');
});


app.post('/userId', function(req, res) {
    let userId = req.body.userId
    let client = clients.filter(client => client.id === userId)
    res.status(200).send(JSON.stringify({success: client.length > 0  }));
});



app.get('/getAllAuctionItems', function(req, res) {
    res.status(200).send(JSON.stringify(auctionObjects));
});

app.post('/register' , (req , res) => {
    console.log(" In server")
    let clientName = req.body.clientName;
    let email = req.body.email;
    let password = req.body.password;
    debugger
    if(!clientName || !email || !password)   return  res.status(400).send(JSON.stringify( 
        { success : false, 
          successMessage : "", 
          errorMessage : " Please provide all the details for registration."}));

    if(clients.findIndex(client => client.email === email) !== -1)  return res.status(400).send(JSON.stringify( 
            { success : false, 
              successMessage : "", 
              errorMessage : " Email already registered. "}));

    clients.push({name : clientName, email, password, id: counter++});
    console.log("Registered "+clientName+" successfully.")
    res.status(200).send(JSON.stringify( 
        { success : true, 
          successMessage : "Successfully registered. ", 
          errorMessage : " "}));
})

app.post('/deRegister' , (req, res) => {
    let clientId = req.body.id;
    let clientIndex = clients.findIndex(client => client.id == clientId);
    if(clientIndex === -1)   {
        return res.status(404).send(JSON.stringify( 
        { success : false, 
          successMessage : "", 
          errorMessage : " An error occurred. "}));
    }
    let itemFound = false;
    Object.keys(auctionObjects).map(key => {
        let item = auctionObjects[parseInt(key)]
        if(item.bidStatus === 'Active' && (item.sellerId === clientId || item.bidderId === clientId)){
            itemFound = true
        }
    })

    if(itemFound)  {
        return res.status(400).send(JSON.stringify( 
        { success : false, 
          successMessage : "", 
          errorMessage : "Cannot de-regisiter if you have an active item in auction "}));
    }
    clients.splice(clientIndex , 1);
    return res.status(200).send(JSON.stringify( 
        { success : true, 
          successMessage : "Successfully de-registered. ", 
          errorMessage : ""}));
})

app.post('/login' , (req,res) => {
    let email = req.body.email;
    let password = req.body.password;
    let client = clients.find(client => client.email == email);
    if(!client || client.password !== password)  {
        return res.status(404).send(JSON.stringify({email : null, id: null, name : null}));
    }
    return res.status(200).send(JSON.stringify({email : client.email, id: client.id, name : client.name}));
})

app.post('/offerSaleItem' , (req , res) => {
    debugger
    let name = req.body.itemName;
    let price = req.body.price;
    let clientId = req.body.id;
    let description = req.body.description;
    if(!name || (!price && price !== 0) || !description ) {
        return  res.status(400).send(JSON.stringify({success: false, errorMessage:" Please give an item name"}));
    }

    let id = Object.keys(auctionObjects).length + 1;
    let startTime = Date.now();
    let endTime = startTime + auctionDuaration;
    let auctionItem  =  {id,name,currentHighestBid : 0, sellerId:clientId,sellerName : clients.find(client => client.id === clientId)!.name,  bidderId : '', bidderName : '', startTime,endTime, price, bidStatus: "Active", description , auctionDuaration, timeLeft : auctionDuaration / 1000} as AuctionItem
    
    auctionObjects[id] = auctionItem
    
    let interval = setInterval( () => { 
        if(auctionObjects[id].currentHighestBid > 0){
            clearInterval(interval)
            auctionObjects[id]['bidStatus'] = "Inactive"
            let auctionItem = auctionObjects[id]
            io.emit('updateAuctionItems', {message : "This item "+ id+ " has been sold to "+ auctionItem.bidderName+ ". ",  auctionItem  });
            return;
        }
        auctionObjects[id]['endTime'] =  Date.now() + auctionDuaration;
        let auctionItem = auctionObjects[id]
        io.emit('updateAuctionItems', {message : "This item "+ id+ " is still in auction." ,  auctionItem  });
    },auctionDuaration , id)

    io.emit('updateAuctionItems', {message : "A new item has been added to Auction." ,  auctionItem});
    return  res.status(200).send(JSON.stringify({success: true, successMessage:" Item has been added to Auction"}));
})

app.post('/bidForItem' , (req,res) => {
    debugger
    let itemId = req.body.itemId;
    let bidAmount = req.body.bidPrice;
    let clientId = req.body.clientId;
    let clientIndex = clients.findIndex(client => client.id == clientId);
    if(clientIndex === -1)   return  res.status(400).send(" An error occurred. ");
    if(!itemId || (!bidAmount && bidAmount !== 0))   return  res.status(400).send((JSON.stringify({ success : false, errorMessage : "  Please provide all the details required for bid. "})));

    let auctionItem = auctionObjects[itemId];
    if(clientId === auctionItem.sellerId) {
        return res.status(400).send(JSON.stringify({ success : false, errorMessage : " You cannot bid for your item. " }));
    }
    if(auctionItem.bidStatus !== 'Active')  return res.status(400).send(JSON.stringify({ success : false, errorMessage: " Auction time is over. "}));
    if(bidAmount < auctionItem.price || auctionItem.currentHighestBid >= bidAmount)   return res.status(400).send(JSON.stringify({ success : false, errorMessage: " Please bid a amount higher than the item price or current highest bid."}));
    
    auctionItem['currentHighestBid'] = bidAmount;
    auctionItem['bidderId'] = clientId;
    auctionItem['bidderName'] = clients[clients.findIndex(client => client.id === clientId)].name;
    io.emit('updateAuctionItems', {message : "A new bid has been added to item :" + itemId ,  auctionItem});
    return res.status(200).send((JSON.stringify({ success : true, successMessage : " Congratulations, Bid placed successfully" })));
})

// http.listen(PORT, () => console.log(`Server started on port ${PORT}`));