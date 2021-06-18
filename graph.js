//Creacion de variable para las graficas

//variables para los objetos de graficas y tablas
let Pline = null;
let Gauge1 = null;
let table;
//variables para los datos
let data_line = [];
let data_table = [];
//obtener los canvas
canvas1 = document.getElementById("cvs_line");

const numvalues = 200;
for(let i = 0; i < numvalues; ++i){
    data_line.push(null);
}
let flag = true;

//Se utiliza la función onload para crear o inicializar las graficas cuando se carga la pagina

window.onload = function () {
    //parametrizar la grafica
    Pline = new RGraph.Line({
        id: 'cvs_line',
        data: data_line,
        options: {
            marginLeft: 75,
            marginRight: 55,
            filled: true,
            filledColors: ['#C2D1F0'],
            colors: ['#3366CB'],
            shadow: false,
            tickmarksStyle: null,
            xaxisTickmarksCount: 0,
            backgroundGridVlines: false,
            backgroundGridBorder: false,
            xaxis: false,
            textSize: 16
        }
    }).draw();

    Gauge1 = new RGraph.Gauge({
        id: 'cvs_gauge',
        min: 0,
        max: 100,
        value: 50,
        options: {
            centery: 120,
            radius: 130,
            anglesStart: RGraph.PI,
            anglesEnd: RGraph.TWOPI,
            needleSize: 85,
            borderWidth: 0,
            shadow: false,
            needleType: 'line',
            colorsRanges: [[0,10,'red'], [10,80,'yellow'],[80,100,'#0f0']],
            borderInner: 'rgba(0,0,0,0)',
            borderOuter: 'rgba(0,0,0,0)',
            borderOutline: 'rgba(0,0,0,0)',
            centerpinColor: 'rgba(0,0,0,0)',
            centerpinRadius: 0
        }
    }).grow();

    table = new Tabulator("#alarm-table", {
        height:"311px",
        layout: "fitColumns",
        columns:[
        {title:"Time", field:"t"},
        {title:"Valor", field:"v", sorter:"number"},
        {title:"Alarma", field:"a"},
        ],
    });
}
//Funciones necesarias para actualizar las graficas

function drawLine(value){
    if(!Pline){return}
    RGraph.Clear(canvas1);
    data_line.push(value);
    if (data_line.length > numvalues){
        data_line = RGraph.arrayShift(data_line); //esto descarta el primer valor del array
    }
    Pline.original_data[0] = data_line;
    Pline.draw();
}

//Conectar al socket y leer el mensaje

//conexion
const socket = io.connect('http://localhost:3700');

socket.on("message2", function (dataValue2){
    drawLine(dataValue2.value);
});

socket.on("message", function (dataValue){
    //drawLine(dataValue2.value);
    //Gauge
    Gauge1.value = dataValue.value;
    Gauge1.grow();
    //Tabla
    if (dataValue.value < 80 && flag == true){
        //agregar la alarma a la tabla y cambiar la bandera.
        flag = false;
        data_table = table.getData();
        data_table.push({t:dataValue.timestamp, v:dataValue.value, a:"Valor muy bajo"});
        table.setData(data_table);
    } else if (flag == false && dataValue.value > 80){
        flag = true;
    }

});