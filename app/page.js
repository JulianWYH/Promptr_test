"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import "./css/login.css";

export default function Login() {

  const router = useRouter();

  const handleStart = () => {
    {
      router.push("./promptr");
    }
  };

  return (
    <div className="TitlePage">


      <div className="contentBx">
        <div className="cloudPane">
          <div className="stars">
            <div className="star" id="star1"></div>
            <div className="star"></div>
            <div className="star" id="star2"></div>
            <div className="star"></div>
            <div className="star" id="star3"></div>
            <div className="star"></div>
            <div className="star" id="star4"></div>
            <div className="star"></div>
            <div className="star" id="star5"></div>
            <div className="star"></div>
            <div className="star" id="star6"></div>
            <div className="star"></div>
            <div className="star" id="star7"></div>
            <div className="star"></div>
            <div className="star" id="star8"></div>
            <div className="star"></div>
            <div className="star" id="star9"></div>
            <div className="star"></div>
            <div className="star" id="star10"></div>
            <div className="star"></div>
            <div className="star" id="star11"></div>
            <div className="star"></div>
          </div>

          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <div className="bigCloud" id={`cloud${n}`} key={n}>
              <div className="largeCircle" id="circ1">
                <div className="largeCircle" id="circ1shadow"></div>
              </div>
              <div className="middleCircle" id="circ2">
                <div className="middleCircle" id="circ2shadow"></div>
              </div>
              <div className="middleCircle" id="circ3">
                <div className="middleCircle" id="circ3shadow"></div>
              </div>
              <div className="smallCircle" id="circ4"></div>
              <div className="smallCircle" id="circ5">
                <div className="smallCircle" id="circ5shadow"></div>
              </div>
              <div className="smallCircle" id="circ6">
                <div className="smallCircle" id="circ6shadow"></div>
              </div>
            </div>
          ))}
        </div>
        <div className="Logo">
          <img src="/logo.png" alt="Logo" className="logoImg" />
        </div>

        <div className="logoNameCtn">
          <div className="leaf1">
            <img src="/Leaves1.png" alt="Leaf 1" className="imgleaf1" />
          </div>

          <div className="logoNameCtn2">
            <div className="LogoName">
              <h1>PROMPTR</h1>
            </div>
          </div>

          <div className="leaf2">
            <img src="/Leaves2.png" alt="Leaf 2" className="imgleaf2" />
          </div>
        </div>

        <div className="OptionsBx">
          <div className="LoginBx">
            <button className="Login">LOGIN</button>
          </div>
          <div className="PlayBx">
            <button className="Play" onClick={handleStart}>START</button>
          </div>
          <div className="FunGameBx">
            <button className="FunGame" onClick={() => router.push("./game")}>FUN GAME MODE</button>
          </div>
        </div>
      </div>
    </div>
  );
}