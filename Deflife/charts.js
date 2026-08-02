/* ==========================
charts.js
========================== */

let weeklyChart = null;
let categoryChart = null;
let moodChart = null;

function renderCharts() {

    renderWeeklyChart();
    renderCategoryChart();
    renderMoodChart();

}

/* ==========================
WEEKLY PRODUCTIVITY
========================== */

function renderWeeklyChart() {

    const canvas = document.getElementById("weeklyChart");

    if (!canvas) return;

    if (weeklyChart) weeklyChart.destroy();

    const counts = {
        Mon:0,
        Tue:0,
        Wed:0,
        Thu:0,
        Fri:0,
        Sat:0,
        Sun:0
    };

    AppState.today.forEach(task=>{

        if(!task.OccurrenceDate) return;

        const day=new Date(task.OccurrenceDate)
        .toLocaleDateString("en-US",{weekday:"short"});

        if(counts[day]!=null)
            counts[day]++;

    });

    weeklyChart=new Chart(canvas,{

        type:"bar",

        data:{

            labels:Object.keys(counts),

            datasets:[{

                label:"Tasks",

                data:Object.values(counts),

                borderRadius:10,

                backgroundColor:[
                    "#4da3ff",
                    "#4da3ff",
                    "#4da3ff",
                    "#4da3ff",
                    "#4da3ff",
                    "#4da3ff",
                    "#4da3ff"
                ]

            }]

        },

        options:{

            responsive:true,

            plugins:{
                legend:{display:false}
            },

            scales:{

                x:{
                    grid:{display:false},
                    ticks:{color:"#94a3b8"}
                },

                y:{
                    beginAtZero:true,
                    ticks:{color:"#94a3b8"},
                    grid:{color:"#233347"}
                }

            }

        }

    });

}

/* ==========================
CATEGORY CHART
========================== */

function renderCategoryChart(){

    const analytics=document.getElementById("analytics");

    if(!analytics) return;

    if(!document.getElementById("categoryChart")){

        analytics.innerHTML=`

<div class="card">

<h2>Category Breakdown</h2>

<canvas id="categoryChart"></canvas>

</div>

<div class="card">

<h2>Mood Trend</h2>

<canvas id="moodTrendChart"></canvas>

</div>

`;

    }

    const ctx=document.getElementById("categoryChart");

    if(categoryChart) categoryChart.destroy();

    const map={};

    AppState.today.forEach(task=>{

        const cat=task.Category||"General";

        map[cat]=(map[cat]||0)+1;

    });

    categoryChart=new Chart(ctx,{

        type:"doughnut",

        data:{

            labels:Object.keys(map),

            datasets:[{

                data:Object.values(map),

                backgroundColor:[

                    "#4da3ff",
                    "#00d084",
                    "#ffb347",
                    "#ff5d73",
                    "#8b5cf6",
                    "#06b6d4"

                ]

            }]

        },

        options:{

            plugins:{

                legend:{

                    labels:{

                        color:"#ffffff"

                    }

                }

            }

        }

    });

}

/* ==========================
MOOD TREND
========================== */

function renderMoodChart(){

    const canvas=document.getElementById("moodTrendChart");

    if(!canvas) return;

    if(moodChart) moodChart.destroy();

    const labels=[];

    const energy=[];

    const focus=[];

    const stress=[];

    AppState.moods.forEach((m,i)=>{

        labels.push(i+1);

        energy.push(Number(m.Energy)||0);

        focus.push(Number(m.Focus)||0);

        stress.push(Number(m.Stress)||0);

    });

    moodChart=new Chart(canvas,{

        type:"line",

        data:{

            labels,

            datasets:[

            {

                label:"Energy",

                data:energy,

                borderColor:"#00d084",

                tension:.4

            },

            {

                label:"Focus",

                data:focus,

                borderColor:"#4da3ff",

                tension:.4

            },

            {

                label:"Stress",

                data:stress,

                borderColor:"#ff5d73",

                tension:.4

            }

            ]

        },

        options:{

            responsive:true,

            plugins:{

                legend:{

                    labels:{

                        color:"#ffffff"

                    }

                }

            },

            scales:{

                x:{

                    ticks:{

                        color:"#94a3b8"

                    }

                },

                y:{

                    beginAtZero:true,

                    max:10,

                    ticks:{

                        color:"#94a3b8"

                    },

                    grid:{

                        color:"#233347"

                    }

                }

            }

        }

    });

}
