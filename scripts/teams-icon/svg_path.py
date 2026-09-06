"""Minimal SVG path parser -> flattened subpath polygons. Deterministic, no external deps."""
import re

NUM = re.compile(r'[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?')

def tokenize(d):
    out=[]
    for m in re.finditer(r'([MmZzLlHhVvCcSsQqTtAa])|([-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?)', d):
        out.append(m.group(1) if m.group(1) else float(m.group(2)))
    return out

def cubic(p0,p1,p2,p3,n):
    pts=[]
    for i in range(1,n+1):
        t=i/n; mt=1-t
        x=mt**3*p0[0]+3*mt*mt*t*p1[0]+3*mt*t*t*p2[0]+t**3*p3[0]
        y=mt**3*p0[1]+3*mt*mt*t*p1[1]+3*mt*t*t*p2[1]+t**3*p3[1]
        pts.append((x,y))
    return pts

def quad(p0,p1,p2,n):
    pts=[]
    for i in range(1,n+1):
        t=i/n; mt=1-t
        pts.append((mt*mt*p0[0]+2*mt*t*p1[0]+t*t*p2[0], mt*mt*p0[1]+2*mt*t*p1[1]+t*t*p2[1]))
    return pts

def parse(d, steps=48):
    """Return list of subpaths, each a list of (x,y)."""
    t=tokenize(d); i=0; cmd=None
    cur=(0.0,0.0); start=(0.0,0.0); prev_c2=None; prev_q1=None
    subs=[]; sp=[]
    def flush():
        nonlocal sp
        if len(sp)>2: subs.append(sp)
        sp=[]
    while i < len(t):
        if isinstance(t[i], str):
            cmd=t[i]; i+=1
            if cmd in "Zz":
                flush(); cur=start; prev_c2=prev_q1=None; continue
        rel = cmd.islower(); C=cmd.upper()
        def rd(n):
            nonlocal i
            v=t[i:i+n]; i+=n; return v
        if C=="M":
            x,y=rd(2)
            if rel: x+=cur[0]; y+=cur[1]
            flush(); cur=(x,y); start=cur; sp=[cur]; prev_c2=prev_q1=None
            cmd = "l" if rel else "L"
        elif C=="L":
            x,y=rd(2)
            if rel: x+=cur[0]; y+=cur[1]
            cur=(x,y); sp.append(cur); prev_c2=prev_q1=None
        elif C=="H":
            (x,)=rd(1)
            if rel: x+=cur[0]
            cur=(x,cur[1]); sp.append(cur); prev_c2=prev_q1=None
        elif C=="V":
            (y,)=rd(1)
            if rel: y+=cur[1]
            cur=(cur[0],y); sp.append(cur); prev_c2=prev_q1=None
        elif C=="C":
            x1,y1,x2,y2,x,y=rd(6)
            if rel: x1+=cur[0];y1+=cur[1];x2+=cur[0];y2+=cur[1];x+=cur[0];y+=cur[1]
            sp+=cubic(cur,(x1,y1),(x2,y2),(x,y),steps); prev_c2=(x2,y2); cur=(x,y); prev_q1=None
        elif C=="S":
            x2,y2,x,y=rd(4)
            if rel: x2+=cur[0];y2+=cur[1];x+=cur[0];y+=cur[1]
            x1,y1 = (2*cur[0]-prev_c2[0], 2*cur[1]-prev_c2[1]) if prev_c2 else cur
            sp+=cubic(cur,(x1,y1),(x2,y2),(x,y),steps); prev_c2=(x2,y2); cur=(x,y); prev_q1=None
        elif C=="Q":
            x1,y1,x,y=rd(4)
            if rel: x1+=cur[0];y1+=cur[1];x+=cur[0];y+=cur[1]
            sp+=quad(cur,(x1,y1),(x,y),steps); prev_q1=(x1,y1); cur=(x,y); prev_c2=None
        elif C=="T":
            x,y=rd(2)
            if rel: x+=cur[0];y+=cur[1]
            x1,y1 = (2*cur[0]-prev_q1[0], 2*cur[1]-prev_q1[1]) if prev_q1 else cur
            sp+=quad(cur,(x1,y1),(x,y),steps); prev_q1=(x1,y1); cur=(x,y); prev_c2=None
        elif C=="A":
            # not used by this mark; treat as a line so a stray arc cannot silently vanish
            _,_,_,_,_,x,y = rd(7)
            if rel: x+=cur[0];y+=cur[1]
            cur=(x,y); sp.append(cur); prev_c2=prev_q1=None
        else:
            raise ValueError("unsupported command %r"%cmd)
    flush()
    return subs
