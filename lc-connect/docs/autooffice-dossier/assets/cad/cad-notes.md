# From a CAD file to a production routing, in one step

An engineer drops a STEP file into the chat. The connector stores it per customer
and immediately starts a background worker: the solid model is converted to a
web-viewable 3D mesh, and every part in it is rendered as a dimensioned 2D
drawing — front, top and side, with overall dimensions in millimetres and a
sheet-thickness callout for flat parts. For this rotor assembly (7 MB) the
conversion takes well under a minute.

The connector then reads the assembly tree straight out of the STEP: 46
bill-of-material positions, 12 sub-assemblies, hierarchical item numbers
(1 / 1.1 / 1.1.1), a quantity on every line (edge multiplicity × parent
quantity), and a bounding box measured from each part's geometry. Every leaf is
classified as made in-house or bought in, and gets a suggested operation list.

Finally the routing: operations in sequence, candidate workstations from the
plant's machine list, and setup/unit times — presented as a proposal. Nothing is
written into the ERP until a person confirms it.

## Captions

**rotor-3d.png** — The rotor assembly as the connector's 3D viewer shows it in
the chat, converted automatically from the uploaded STEP file. Rotate, zoom, no
CAD licence and no plug-in required.

**rotor-breakdown.png** — The assembly broken down by the connector: repeatable
part families and one-off parts, each with quantity and overall dimensions read
from the geometry, colour-coded into made / bought / assembled, with the bought
components listed separately and uncertain names flagged for review.

**rotor-routing.png** — A proposed routing for one manufactured part of the
rotor (a blade, 251.5 × 8 × 407.9 mm, ≈ 8 mm sheet): cutting, bending, drilling,
each with unit time Tj, setup time Tpz and the candidate workstations, shown
next to the machine-generated dimensioned projection of the same part.
