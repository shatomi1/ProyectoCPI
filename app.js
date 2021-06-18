/* Importación de modulos */

const express = require("express");
const {cyan, bgRed} = require("chalk");
const listen = require("socket.io");
const MongoClient = require('mongodb').MongoClient; 
const { AttributeIds, OPCUAClient, TimestampsToReturn, DataValue } = require("node-opcua");

/* Creación de constantes para la comunicacion y la base de datos */

//opc ua
const endpointUrl = "opc.tcp://DESKTOP-DINE7V8:4840";
const nodeIdToMonitor = "ns=4;s=|var|CODESYS Control Win V3 x64.Application.GVL.Nivel";
const nodeIdToMonitor2 = "ns=4;s=|var|CODESYS Control Win V3 x64.Application.GVL.Peso";




//aplicacion web
const port = 3700;

//mongo db
const uri = "mongodb+srv://luism:javeriana@proyectocpi.8t7rb.mongodb.net/myFirstDatabase?retryWrites=true&w=majority";
const clientmongo = new MongoClient(uri, { useNewUrlParser: true});



//CODIGO PRINCIPAL CON FUNCION TIPO ASYNC

(async () => { //await
    try{
        //crear el cliente opcua
        const client = OPCUAClient.create();

        //avisar cuando se esta intentando reconectar
        //cada que se detecte backoff, se genera una acción de reconexión.
        client.on("backoff", (retry, delay) => {
            console.log("Retrying to connect to ", endpointUrl, " attempt ", retry);
        }); 

        //mostrar las URL cuando logre conectar
        console.log(" connecting to ", cyan(endpointUrl));
        await client.connect(endpointUrl); //Esperar que se haga la conexión.
        console.log(" connected to ", cyan(endpointUrl));

        //Iniciar la sesion para interactuar con el servidor opc ua
        const session = await client.createSession();
        console.log("sesion iniciada".yellow);

        //crear una suscripcion
        const subscription = await session.createSubscription2({
            requestedPublishingInterval: 200, //200ms
            requestedMaxKeepAliveCount: 20, //cuantas veces va a intentar mantener viva conexión
            publishingEnabled: true,
        });
        
        //Se inicia el monitoreo de la variable del servidor opcua

        //Crear el item con su nodeId y atributo
        const itemToMonitor = {
            nodeId: nodeIdToMonitor, //variable a monitorear
            attributeId: AttributeIds.Value //atributo que queremos leer
        };
        //Definir los parametros de monitoreo
        const parameters = {
            samplingInterval: 50, //tiempo de muestreo
            discardOldest: true, //Para descartar los valores anteriores
            queueSize: 100 //Tamaño de la cola
        };
        //Crear el objeto de monitoreo
        const monitoredItem = await subscription.monitor(itemToMonitor, parameters, TimestampsToReturn.Both);

/////////////////////////////////CREAR SEGUNDA VARIABLE/////////////////////////////////////////////////////////////
        //Crear el item con su nodeId y atributo
        const itemToMonitor2 = {
            nodeId2: nodeIdToMonitor2, //variable a monitorear
            attributeId2: AttributeIds.Value//atributo que queremos leer
        };
        //Crear el objeto de monitoreo
        const monitoredItem2 = await subscription.monitor(itemToMonitor2, parameters, TimestampsToReturn.Both);

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

        //crear la aplicacion
        const app = express();
        app.set("view engine", "html");

        //definir el directorio de estaticos
        app.use(express.static(__dirname + '/')); //definir el directorio de estaticos
        app.set('views',__dirname + '/');

        //defnir como se responde cuando el navegador solicita entrar
        app.get("/", function(req,res) {
            res.render('index.html'); //Aqui se llama la pagina html que se va a utilizar
        });

        //Se crea un objeto listen para enviar datos a la aplicacion web
        // io.socket --> "real-time bidrectional event-based communication"

        //asociar el puerto a la app web
        const io = listen(app.listen(port));

        //esperar la conexion
        io.sockets.on('connection', function (socket) {
        });
        
        //mostrar el url para entrar a la aplicacion web
        console.log("Listening on port " + port);
        console.log("visit http://localhost:" + port);

        //conexion a la base de datos

        //conectar el cliente
        await clientmongo. connect();

        //conectarese a la coleccion con los datos del mongodb atlas
        const collection = clientmongo.db("mydb").collection("mycollection");

        //////////////////////////////////////////////////////////////
        //definimos que hacer cuando la variable monitoreada "cambie"
        monitoredItem.on("changed", (dataValue) => {
            //escribir el valor en la base de datos
            collection.insertOne({ 
                valor: dataValue.value.value, 
                time: dataValue.serverTimestamp
                });
            io.sockets.emit("message", {
                //El mensaje contiene:
                value: dataValue.value.value, //valor de la variable
                timestamp: dataValue.serverTimestamp, //tiempo
                nodeId: nodeIdToMonitor, //nodeid del nodo opcua
                browseName: "Nombre" //nombre de busqueda
                });
        });

        ///VARIABLE MONITOREADA 2///////////////////////////////////////////////////
        monitoredItem2.on("changed", (dataValue2) => {
            //escribir el valor en la base de datos
            collection.insertOne({ 
                valor2: dataValue2.value.value, 
                time2: dataValue2.serverTimestamp
                });
            io.sockets.emit("message2", {
                //El mensaje contiene:
                value2: dataValue2.value.value, //valor de la variable
                timestamp2: dataValue2.serverTimestamp, //tiempo
                nodeId2: nodeIdToMonitor2, //nodeid del nodo opcua
                browseName2: "Nombre" //nombre de busqueda
                });
        });

        ////////////////////////////////////////////////////////////////////////
        //Salir al presional CTRL+C
        let running = true;
        process.on("SIGINT", async () => { //evento tipo sigint, cuando el evento termina.
            if(!running){
                return; //avoid calling shutdown twice
            }
            console.log("shutting down client");
            running = false;
            await clientmongo.close();
            await subscription.terminate();
            await session.close();
            await client.disconnect();
            console.log("Done");
            process.exit(0);
        });
    }
    catch (err){
        //Aqui ponemos que pasa si al internar lo anterior, hay un error.
        console.log(bgRed.white("Error" + err.message));
        console.log(err);
        process.exit(-1);
    }


})(); //la funcion se estara ejecutando