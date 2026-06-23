const VehicleImage = ({ src, alt, mini }) => (
  <div className="vehicle-image-wrap">
    <img
      className="vehicle-image"
      src={src}
      alt={alt}
      style={{ height: mini ? 50 : 180 }}
      draggable="false"
    />
  </div>
);

export function BikeIcon({ mini }) {
  return <VehicleImage src="/assets/bike.png" alt="Bike" mini={mini} />;
}

export function CarIcon({ mini }) {
  return <VehicleImage src="/assets/truck.png" alt="Car" mini={mini} />;
}

export function TruckIcon({ mini }) {
  return <VehicleImage src="/assets/car.png" alt="Heavy Vehicle" mini={mini} />;
}
