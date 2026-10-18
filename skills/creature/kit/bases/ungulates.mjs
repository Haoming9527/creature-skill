import { bovineBase } from './bovine.mjs';
/** Original, editable proportional control cages. Dimensions are art-direction
 * defaults in metres, not breed standards or a veterinary anatomical model.
 * Axes: +X anterior, +Y dorsal/up, +Z animal's left. */
export const BASES = {
  thoroughbred: {
    label: 'Original anatomical equine cage', bodyY: 1.27, bodyDepth: .36, bodyWidth: .275,walkClearance:.052,
    torsoLength: 1.8, legHeight: 1.08, neckPivot: [.60, 1.43, 0], headPivot: [1.175, 1.91, 0],
    torso: [
      [-1.025,1.34,.075,.075],[-.995,1.32,.18,.15],[-.93,1.30,.265,.22],
      [-.85,1.29,.305,.256],[-.76,1.285,.321,.275],[-.67,1.28,.320,.282],
      [-.58,1.27,.315,.278],[-.50,1.26,.310,.266],[-.42,1.25,.310,.260],
      [-.32,1.24,.325,.266],[-.20,1.235,.343,.275],[-.08,1.235,.355,.280],
      [.04,1.24,.367,.281],[.15,1.25,.377,.277],[.23,1.265,.385,.272],
      [.32,1.30,.400,.269,.16],[.41,1.33,.400,.262,.22],[.50,1.38,.390,.248,.34],
      [.59,1.44,.370,.225,.40],[.66,1.50,.350,.198,.47]
    ],
    // Independent sagittal boundaries keep the sacrum, loin and abdominal
    // flank a single authored sweep instead of overlapping local bulges.
    // Fitted to lateral Thoroughbred references: croup and withers at similar
    // height with a short, nearly level back; the girth is the lowest point of
    // the trunk and the abdomen rises steadily to the flank.
    dorsalHeights:[1.440,1.545,1.630,1.680,1.700,1.702,1.694,1.682,1.670,1.658,1.652,1.652,1.656,1.668,1.684,1.715,1.738,1.762,1.790,1.815],
    ventralHeights:[1.235,1.120,1.075,1.075,1.085,1.085,1.077,1.062,1.045,1.018,.992,.975,.962,.955,.950,.965,1.012,1.040,1.150,1.250],
    // x, y, radius in sagittal plane, half width, ring-plane angle (radians)
    neckHead: [
      [.726,1.552,.340,.176,.51],[.797,1.639,.300,.160,.57],
      [.875,1.720,.260,.143,.63],[.961,1.802,.220,.125,.64],
      [1.042,1.874,.170,.108,.60],[1.101,1.897,.135,.096,.50],
      [1.138,1.901,.117,.089,.42],
      [1.175,1.910,.120,.092,.35],[1.215,1.920,.129,.102,-.05],
      [1.255,1.905,.140,.115,-.55],[1.295,1.860,.140,.120,-.73],
      [1.345,1.805,.126,.110,-.78],[1.385,1.755,.100,.082,-.80],
      [1.425,1.705,.085,.067,-.82],[1.465,1.660,.079,.064,-.82],
      [1.505,1.615,.078,.071,-.82],[1.545,1.570,.077,.077,-.80],
      [1.585,1.525,.079,.085,-.78],[1.630,1.487,.077,.094,-.72],
      [1.670,1.465,.058,.082,-.60],[1.680,1.458,.055,.075,-.60],
      [1.695,1.448,.041,.057,-.60],[1.705,1.441,.022,.032,-.60],
      [1.710,1.438,.002,.004,-.60]
    ],
    headSectionStart:7,
    legs: {
      // Limbs converge medially: front hooves about .30 m apart under a narrower
      // chest, hind stifles lateral with hocks and hooves set well inside them.
      front: {root:[.66,1.23,.214],joint:[.40,.99,.214],knee:[.47,.54,.208],ankle:[.47,.20,.186],foot:[.54,.071,.182],radii:[.158,.099,.077,.052,.031,.050,.049]},
      hind: {root:[-.70,1.36,.218],joint:[-.51,.99,.230],knee:[-.82,.63,.165],ankle:[-.83,.20,.155],foot:[-.76,.071,.155],radii:[.205,.143,.102,.055,.031,.050,.049]}
    },
    eye:[1.318,1.901,.112], eyeRadius:.026,
    ear:[1.185,2.01,.065], earVector:[.005,.18,.028], earWidth:.045,
    nostril:[1.617,1.522,.080], nostrilSize:[.033,.023],
    jawPivot:[1.245,1.805,0],
    jaw:[ [1.255,1.735,.079,.093], [1.33,1.655,.075,.091], [1.43,1.555,.047,.068], [1.535,1.459,.034,.073], [1.63,1.415,.026,.081] ],
    mouth:[1.625,1.435,0],
    tailRoot:[-.97,1.48,0], tailPath:[[-.97,1.48,0],[-1.10,1.40,0],[-1.16,1.16,0],[-1.19,.84,0],[-1.21,.50,0],[-1.24,.23,0]],
    manePath:[[.29,1.715,.005],[.45,1.78,.006],[.56,1.85,.008],[.65,1.94,.008],[.82,2.00,.007],[.95,2.035,.005],[1.09,2.03,.004],[1.175,2.03,0]],
    hoof:{length:.174,width:.122,height:.105},
    // Final landmark warp of the assembled head (head-scale units, u from the
    // poll along a 50-degree facial axis). Fitted against lateral reference
    // photographs: poll-to-muzzle about .63 m, eye near one third of head
    // length, deep rounded jowl tapering straight to a .16 m muzzle.
    headWarp:{origin:[1.20,2.03,0],angle:.8727,faceStart:.22,faceBlend:.05,faceLength:.73,depthLine:-.03,depthCap:.28,maskBelow:-.68,maskBand:.26,
      dorsal:[[0,.024],[.08,.083],[.2,.095],[.3,.07],[.44,.045],[.7,.054]],
      depth:[[0,1],[.08,1.04],[.16,1.18],[.26,1.22],[.36,1.16],[.50,1.10],[.64,1.07],[.74,1.03],[.80,1]],
      width:[[0,1],[.30,1],[.42,1.04],[.60,1.06],[.80,1.02]]},
  },
  holstein: bovineBase
};

export const ORIGINAL_BASE_NOTICE = 'Original procedural control cage; not human-reviewed or anatomically certified. Proportions are illustrative breed interpretations.';
