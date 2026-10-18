/** Original dairy-cow landmark study. Metres; +X anterior, +Y dorsal, +Z left.
 * Authored against the Holstein USA linear-traits and PDCA conformation guides.
 * These are explicit artist landmarks, not a scan or a breed measurement table.
 * The moderate dairy condition target retains capacity without beef musculature.
 */
export const bovineBase = {
  label:'Original Holstein landmark cage, revision 2',
  bodyY:1.06,bodyDepth:.425,bodyWidth:.355,torsoLength:1.98,legHeight:.86,
  walkClearance:.045,
  neckPivot:[.70,1.23,0],headPivot:[1.11,1.405,0],
  // x, center height, dorsal radius, half width. The dedicated skin builder
  // adds the asymmetric flank, loin, hooks, scapula and brisket transitions.
  torso:[
    [-1.055,1.145,.125,.13],[-1.025,1.125,.265,.225],
    [-.96,1.095,.345,.29],[-.87,1.08,.375,.32],
    [-.77,1.075,.385,.335],[-.67,1.065,.405,.35],
    [-.57,1.045,.425,.365],[-.45,1.03,.44,.38],
    [-.30,1.02,.45,.39],[-.14,1.025,.445,.38],
    [.02,1.035,.435,.355],[.17,1.055,.425,.33],
    [.30,1.08,.405,.30],[.42,1.105,.395,.275],
    [.53,1.135,.365,.25],[.63,1.19,.30,.218],
    [.72,1.26,.225,.178]
  ],
  // The rump does not continue as a low, round abdominal bulb behind the legs.
  // Its ventral contour rises into the perineum between the rear thighs.
  ventralRadii:[.075,.105,.155,.215,.285,.335,.355,.350,.350,.345,.350,.360,.370,.350,.315,.32,.28],
  neckHead:[
    [.81,1.30,.175,.143,.30],[.90,1.34,.147,.124,.30],
    [.985,1.365,.145,.126,.22],[1.065,1.408,.136,.132,.06],
    [1.13,1.418,.145,.149,-.38],[1.185,1.352,.164,.162,-.65],
    [1.232,1.286,.141,.132,-.83],[1.280,1.225,.112,.112,-.88],
    [1.323,1.171,.099,.116,-.89],[1.360,1.125,.097,.129,-.91],
    [1.393,1.090,.091,.134,-.93],[1.414,1.067,.071,.125,-.93],
    [1.429,1.052,.059,.112,-.93],[1.434,1.047,.051,.100,-.93]
  ],
  legs:{
    // Shoulder lies anterior to the elbow: a caudally sloping humerus, not a
    // nearly vertical continuation of the forearm. Photo-guided estimates.
    front:{root:[.64,1.18,.213],joint:[.42,.91,.227],knee:[.51,.485,.235],ankle:[.51,.158,.235],foot:[.57,.067,.235],radii:[.118,.090,.064,.047,.033,.045,.048]},
    hind:{root:[-.775,1.265,.264],joint:[-.62,.89,.282],knee:[-.835,.475,.283],ankle:[-.77,.158,.283],foot:[-.705,.067,.283],radii:[.17,.128,.088,.053,.032,.043,.047]}
  },
  eye:[1.190,1.427,.144],eyeRadius:.028,
  ear:[1.075,1.470,.111],earVector:[-.085,.012,.280],earWidth:.062,
  nostril:[1.405,1.111,.128],nostrilSize:[.029,.019],
  jawPivot:[1.145,1.309,0],
  jaw:[[1.09,1.345,.078,.105],[1.158,1.259,.102,.132],[1.218,1.185,.081,.122],[1.280,1.107,.059,.113],[1.342,1.047,.045,.120],[1.388,1.016,.029,.115]],
  tailRoot:[-1.02,1.413,0],
  tailPath:[[-1.02,1.413,0],[-1.105,1.405,0],[-1.15,1.04,0],[-1.17,.76,0],[-1.19,.51,0],[-1.21,.29,0]],
  manePath:[],hoof:{length:.153,width:.126,height:.098},
  anatomicalLandmarks:{withers:[.36,1.495,0],hook:[-.65,1.425,.282],pin:[-.99,1.348,.225],brisket:[.58,.82,0],stifle:[-.62,.89,.282],hock:[-.835,.475,.283]},
  referenceSources:[
    'https://www.holsteinusa.com/pdf/print_material/linear_traits.pdf',
    'https://www.holsteinusa.com/pdf/PDCA_Scorecard.pdf'
  ]
};
