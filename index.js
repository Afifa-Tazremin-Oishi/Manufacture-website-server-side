// require express, cors, mongodb, jwt, dotenv and stripe
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);



// declare app and port
const app = express();
const port = process.env.PORT || 5000;



// use middleware
app.use(cors());
app.use(express.json());



// verify jwt

function verifyJWT(req, res, next) {

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorized Access' });
    }
    const token = authHeader.split(' ')[1];

    // verify jwt
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {

        if (err) {
            return res.status(403).send({ message: 'Forbidden Access' });
        }

        else {
            req.decoded = decoded;
            
            next();
        }
    })
}






// connect with mongo database

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.amdeuld.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });



// set connection function
async function run() {
    try {
        await client.connect();

        // tools collection
        const toolsCollection = client.db("manufacturer").collection("tools");

        // purchase order collection
        const orderCollection = client.db("manufacturer").collection("orders");

        // create user collection
        const userCollection = client.db("manufacturer").collection("users")

        // create payment collection
        const paymentCollection = client.db("manufacturer").collection("payments");

        // create payment collection
        const reviewCollection = client.db("manufacturer").collection("reviews");

        // create shipped collection
        const shippedCollection = client.db("manufacturer").collection("shipped");



        // verify admin

        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester });

            if (requesterAccount.role === 'admin') {
                next();
            }
            else {
                res.status(403).send({ message: 'Forbidden' });
            }
        }






        // get all users [only admin can access this]

        app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users);
        })



        // update user and issue token
        // update user information [create new or update/modify]

        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };

            // create a document that sets the user data
            const updateDoc = {
                $set: user
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);

            // token issue
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' });

            res.send({ result, token });
        });



        // get all admin

        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin });
        })



        // get make admin request and create admin a user

        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };

            // create a document that sets the user's updated data
            const updateDoc = {
                $set: { role: 'admin' }
            };

            // update user
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);

        })




        /* ----- TOOLS COLLECTION API ----- 
        -----------------------------------*/


        // get all tools

        app.get('/tools', async (req, res) => {
            const query = {};
            const cursor = toolsCollection.find(query);
            const tools = await cursor.toArray();
            res.send(tools);
        });


        // get a specific tool by id

        app.get('/tools/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const tool = await toolsCollection.findOne(query);
            res.send(tool);
        });



        // post a tool data

        app.post('/tools', async (req, res) => {
            const tool = req.body;
            const result = await toolsCollection.insertOne(tool);
            res.send(result);
        });



        // update data : update a tool's quantity after getting order

        app.put('/tools/:id', async (req, res) => {

            const id = req.params.id;
            const updatedItem = req.body;

            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };

            const updatedDoc = {
                $set: {
                    available: updatedItem.quantity,
                }
            };
            const result = await toolsCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        })


        // delete tool

        // delete data : delete a specific tool item
        app.delete('/tool/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await toolsCollection.deleteOne(query);
            res.send(result);
        })





        /* ----- REVIEW COLLECTION API ----- 
        ------------------------------------*/


        // get all review

        app.get('/reviews', async (req, res) => {
            const query = {};
            const cursor = reviewCollection.find(query);
            const reviews = await cursor.toArray();
            res.send(reviews);
        });



        // post a review data

        app.post('/review', async (req, res) => {
            const review = req.body;
            const result = await reviewCollection.insertOne(review);
            res.send(result);
        });





        /* ----- ORDER COLLECTION API ----- 
        -----------------------------------*/


        // get all orders

        app.get('/orders', verifyJWT, async (req, res) => {
            const query = {};
            const cursor = orderCollection.find(query);
            const orders = await cursor.toArray();
            res.send(orders);

        })


        // get orders for specific verified user

        app.get('/order', verifyJWT, async (req, res) => {

            const buyer = req.query.buyer;
            const decodedEmail = req.decoded.email;

            if (buyer === decodedEmail) {
                const query = { buyer: buyer };
                const orders = await orderCollection.find(query).toArray();
                res.send(orders);
            }
            else {
                return res.status(403).send({ message: 'Forbidden Access' });
            }

        });



        // get a specific order for verified user

        app.get('/orders/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const order = await orderCollection.findOne(query);
            res.send(order);
        })



        // post orders

        app.post('/orders', async (req, res) => {
            const order = req.body;
            const result = await orderCollection.insertOne(order);
            res.send(result);
        })



        // delete data : delete a specific order item

        app.delete('/orders/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await orderCollection.deleteOne(query);
            res.send(result);
        })


        // update orders after payment

        app.patch('/order/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }

            const result = await paymentCollection.insertOne(payment);
            const updatedOrder = await orderCollection.updateOne(filter, updatedDoc);
            res.send(updatedOrder);
        })


        // update orders after shipment

        app.put('/order/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const shipment = req.body;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true }
            const updatedDoc = {
                $set: {
                    shipment: true
                }
            }

            const result = await shippedCollection.insertOne(shipment);
            const updatedOrder = await orderCollection.updateOne(filter, updatedDoc, options);
            res.send(updatedOrder);
        })




        /* ----- PAYMENT COLLECTION API ----- 
        -------------------------------------*/


        // payement intention api create

        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const order = req.body;
            const price = order.price;
            const quantity = order.quantity;
            const amount = price * quantity;

            // Create a PaymentIntent with the order amount and currency
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ['card']
            });

            res.send({
                clientSecret: paymentIntent.client_secret
            });
        })

    }

    finally {
        // client.close();
    }
}


run().catch(console.dir);




// check server root api
app.get('/', (req, res) => {
    res.send('Manufacturer company is ready to supply tools')
});



// listening port
app.listen(port, () => {
    console.log('Manufacturer is listening', port);
})